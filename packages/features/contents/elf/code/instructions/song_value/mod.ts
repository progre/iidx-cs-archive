/**
 * 曲値16bit化と項目配列移設の書き換えと、stub本体を作る。
 *
 * 入力は、stub以外の書き換えを全て当てたELFと、そのとき出た`far_lo`行、そして曲値・
 * 項目・mode・flagsを触るsiteの一覧。siteの命令はそのELFの命令語のままstubへ預けるので、
 * 返す行の旧命令語もそのELFの値になる。
 */

import type { InstructionPatch, MutableElf } from "../../../elf/mod.ts";
import { rsOf, rtOf } from "../../mips/mod.ts";
import { STUB_SLOTS } from "../../../data/stub_area/mod.ts";
import { relocate } from "./calls.ts";
import { emitFixedSites } from "./fixed_sites.ts";
import { place, type Placement, type Site } from "./forms.ts";
import {
  makeItemLayout,
  siteDeltas,
  type SiteKind,
  type SongValueSite,
} from "./layout.ts";
import { Program, SONG_VALUE_WIDTH_ACTION } from "./program.ts";
import { far, farConstant, widenFar } from "./far.ts";
import { widen } from "./widen.ts";

export { SONG_VALUE_WIDTH_ACTION };
export type { SiteKind, SongValueSite };

const SLOT = STUB_SLOTS.songValue;

/** owner Cの`+0x58`はscalar fieldで、owner Bの項目配列と同じoffsetに見えるだけ。 */
const EXCLUDED_SITES = new Set([
  0x1b27e8,
  0x1b3df8,
  0x1b617c,
  0x1b61a8,
  0x1b620c,
]);

export type SongValueWidth = Readonly<{
  patches: readonly InstructionPatch[];
  stubBytes: Uint8Array;
}>;

export type SongValueInput = Readonly<{
  /** record容量`E`。record内の曲index上位配列までの距離になる。 */
  entries: number;
  /** 前段が出した書き換え。`far_lo`行だけをstubへ回す。 */
  precedingPatches: readonly InstructionPatch[];
  /** 項目配列の容量`C`。 */
  itemCapacity: number;
  sites: readonly SongValueSite[];
}>;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

/** 定数を作る命令(基底がzero、または共有luiの`ori rt,rt`)は基底を使わず作り直す。 */
const isConstantForm = (word: number) =>
  rsOf(word) === 0 || (word >>> 26 === 0x0d && rsOf(word) === rtOf(word));

export function buildSongValueWidth(
  elf: MutableElf,
  input: SongValueInput,
): SongValueWidth {
  const layout = makeItemLayout(input.entries, input.itemCapacity);
  const program = new Program(elf);

  // 上位配列を持つsite(曲index、項目)はstubへ、持たないsite(mode、flags)は即値だけ移す。
  const siteMap = new Map<number, Site>();
  const highDeltas = new Map<number, number>();
  for (const site of input.sites) {
    if (EXCLUDED_SITES.has(site.address) || siteMap.has(site.address)) continue;
    const word = program.effectiveWord(site.address);
    const { low, high } = siteDeltas(layout, site);
    if (high === undefined) {
      program.rewrite(
        site.address,
        relocate(word, low),
        "relocate:" + site.kind,
      );
      continue;
    }
    highDeltas.set(site.address, high);
    siteMap.set(site.address, {
      address: site.address,
      widened: widen(word, low, high).words,
      word,
    });
  }
  // 前段で上位16bitを作れなかった低位命令。共有luiが割れた形はrationaleに`lui=`で
  // 揃えた先のluiを持ち、その値との差を作る。luiを持たない即値の溢れは差が全offsetになる。
  // 曲値siteと重なるときは、基底の作り直しと上位byteの合成を1つのstubで行う。
  for (const row of input.precedingPatches) {
    if (row.referenceForm !== "far_lo") continue;
    const word = program.effectiveWord(row.address);
    const target = Number(row.newReference);
    const lui = /lui=(0x[0-9a-f]+)/.exec(row.rationale);
    const retainedHigh = lui === null
      ? 0
      : program.wordAt(Number(lui[1])) & 0xffff;
    const high = highDeltas.get(row.address);
    const widened = high !== undefined
      ? widenFar(word, target, retainedHigh, high)
      : isConstantForm(word)
      ? farConstant(word, target)
      : far(word, target, retainedHigh);
    siteMap.set(row.address, { address: row.address, widened, word });
  }

  const blob: number[] = [];
  const emitStub = (words: readonly number[]): number => {
    const base = SLOT.vaddr + blob.length * 4;
    blob.push(...words);
    return base;
  };

  for (
    const site of [...siteMap.values()].sort((a, b) => a.address - b.address)
  ) {
    if (program.isConsumed(site.address)) continue;
    const chained = siteMap.get(site.address + 4);
    const stubBase = SLOT.vaddr + blob.length * 4;
    const placement: Placement = place(
      site,
      program.context,
      stubBase,
      chained !== undefined && !program.isConsumed(chained.address)
        ? chained
        : undefined,
    );
    assert(emitStub(placement.words) === stubBase, "stub基底が一致しない");
    program.consume(placement.consumed);
    for (const [address, word] of placement.patches) {
      program.emitRow(address, word, "site:" + placement.form);
    }
  }
  program.emitUnconsumedRewrites();
  emitFixedSites(program, layout, emitStub);

  assert(blob.length * 4 <= SLOT.bytes, "stubが確保容量を超える");
  const stubBytes = new Uint8Array(blob.length * 4);
  const view = new DataView(stubBytes.buffer);
  blob.forEach((word, index) => view.setUint32(index * 4, word, true));
  return { patches: program.rows(), stubBytes };
}
