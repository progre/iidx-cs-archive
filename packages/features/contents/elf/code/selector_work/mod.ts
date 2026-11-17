/**
 * 選曲ワークを曲数と選曲record容量に広げる書き換えを作る。
 * 曲indexを16bitで扱う配置(`wide`)だけを組み、上位byte配列を含むrecord長を選ぶ。
 */

import {
  type InstructionPatch,
  InstructionPatchBook,
  type MutableElf,
  requireWord,
} from "../../elf/mod.ts";
import {
  buildSongIndexLbuPatches,
  buildSongIndexSext32Patches,
} from "../instructions/song_index/mod.ts";
import type { SongCapacity } from "../../model/mod.ts";
import type { DirectGroup } from "./allowlist/mod.ts";
import { makeAppendLayout, verifyAppendLayout } from "./append_layout.ts";
import type { WorkLayout } from "./layout.ts";
import { buildExactPatchMapForLayout } from "./exact.ts";
import {
  addAppendZeroFill,
  addStackFrameGrowth,
  ZERO_FILL_SITES,
} from "./patch/mod.ts";
import { isEntriesDependent } from "./usage.ts";

// 世代Cの曲index lbuと、Eで動く曲index offsetは同じ命令に重なる。
// 帳簿は同一actionのときだけビット単位で統合するため、単一actionにまとめる。
export const E_APPEND_ACTION = "apply_generation_c_e_append";
/** 曲×難易度表を呼び出し元の固定1984バイトstack配列へ複製する長さ。Nに追従させない。 */
const STACK_COPY_LENGTH_ADDRESS = 0x20d110;
const LBU_COUNT = 55;
const DSRL32_COUNT = 17;

export type SelectorWorkPatches = Readonly<{
  /** 選曲record容量で位置が動く命令の数。 */
  entriesCount: number;
  /** 配置から直に決まる命令の数。 */
  exactCount: number;
  /** 共有luiが割れてstubへ回した低位命令の数。 */
  farCount: number;
  /** 曲indexを符号なしで読む世代差分の数。 */
  generationCount: number;
  rows: readonly InstructionPatch[];
  /** stack frameを深くする命令の数。深くならない構成では0。 */
  stackFrameCount: number;
}>;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

/** 曲indexを符号なしで読む世代差分。E配置と同じ命令に重なるので先に入れる。 */
function addGenerationPatches(
  book: InstructionPatchBook,
  elf: MutableElf,
): void {
  const lbu = buildSongIndexLbuPatches(elf);
  const dsrl32 = buildSongIndexSext32Patches(elf);
  // lbuは即値0x1f8の43件と、pointer形・record1形の12件からなる。
  assert(
    lbu.length === LBU_COUNT && dsrl32.length === DSRL32_COUNT,
    "世代C差分の件数が一致しません",
  );
  for (const row of [...lbu, ...dsrl32]) {
    const { action: _action, address, newWord, oldWord: _old, ...metadata } =
      row;
    book.add(address, newWord, { ...metadata, action: E_APPEND_ACTION });
  }
}

/** CSAの選曲ワークの配置。曲値を16bitで扱うappend配置 */
export const selectorWorkLayout = (capacity: SongCapacity): WorkLayout =>
  makeAppendLayout(
    capacity.songCount,
    capacity.records,
    capacity.recordSize,
    true,
  );

export function buildSelectorWorkPatches(
  elf: MutableElf,
  capacity: SongCapacity,
  directGroups: readonly DirectGroup[],
): SelectorWorkPatches {
  return buildAppendPatches(elf, selectorWorkLayout(capacity), directGroups);
}

/** 配置を直に渡す関数。曲数と容量の組み合わせを試す監査が使う。 */
export function buildAppendPatches(
  elf: MutableElf,
  layout: WorkLayout,
  directGroups: readonly DirectGroup[],
): SelectorWorkPatches {
  verifyAppendLayout(layout);
  const wordAt = (address: number) => requireWord(elf, address);
  const book = new InstructionPatchBook(elf);
  addGenerationPatches(book, elf);
  const exact = buildExactPatchMapForLayout(elf, layout, directGroups);
  // far_loの低位命令は曲値16bit化のstubが差し替える。16bit化しない配置では
  // その段が無いので、共有luiが割れたら配置そのものを見直す。
  assert(
    layout.songIndexHighOffset !== undefined || exact.farCount === 0,
    "16bit化しない配置でfar_loが発生しました",
  );
  // ゼロ埋めの長さは`addAppendZeroFill`だけが書く。配置によっては上位が原盤と同じで現れない
  const zeroFillRows =
    exact.rows.filter((row) => ZERO_FILL_SITES.has(row.address)).length;
  const applicableRows = exact.rows.filter((row) =>
    row.address !== STACK_COPY_LENGTH_ADDRESS &&
    !ZERO_FILL_SITES.has(row.address)
  );
  assert(
    applicableRows.length === exact.rows.length - 1 - zeroFillRows,
    "固定stack copy長がexact patchに現れていません",
  );
  for (const row of applicableRows) {
    const { action: _, address, newWord, oldWord, ...metadata } = row;
    book.add(
      address,
      newWord,
      { ...metadata, action: E_APPEND_ACTION },
      oldWord,
    );
  }
  addAppendZeroFill(book, layout.structSize, E_APPEND_ACTION, wordAt);
  const stackFrameCount = addStackFrameGrowth(
    book,
    layout.recordSize,
    E_APPEND_ACTION,
    wordAt,
  );
  return {
    entriesCount: applicableRows.filter((row) => isEntriesDependent(row.usage))
      .length,
    exactCount: applicableRows.length,
    farCount: exact.farCount,
    generationCount: LBU_COUNT + DSRL32_COUNT,
    rows: book.rows(),
    stackFrameCount,
  };
}
export {
  addedFolderSlot,
  addedFolderStart,
  makeAppendLayout,
  verifyAppendLayout,
} from "./append_layout.ts";
export type { WorkLayout } from "./layout.ts";
