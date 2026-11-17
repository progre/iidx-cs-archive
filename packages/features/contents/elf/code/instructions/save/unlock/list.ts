/**
 * 既定で譜面有効bitを立てる曲index一覧を全曲にする。
 *
 * 初期化は末尾で、表A用(`0x2858c0`)と表B用(`0x285980`)のint16の-1終端一覧を辿る。
 * 一覧にある曲は、各entryのbyte+3 bit7が立つ。
 * 選曲リストへの登録の判定は表Bのbitを見る。そのため一覧に無い曲は並ばない。
 * 原盤の一覧は隠し曲を除いている。また、詰めて置かれているので延長できない。
 * そこで全曲の一覧をstub領域に置き、一覧を返す命令をそこへ向ける。
 * 一覧を辿る関数は、rowを即値3と比べてrow 3(黒ANOTHER)を飛ばす。
 * rowは0〜3なので、この即値を4に変えると全rowのbitが立つ。
 */

import {
  type InstructionPatch,
  type MutableElf,
  requireWord,
} from "../../../../elf/mod.ts";
import { immOf, withImmediate } from "../../../mips/mod.ts";
import { assert, hex } from "../common.ts";

export const UNLOCK_LIST_ACTION = "apply_unlock_list";
const TERMINATOR = 0xffff;
/** 原盤の一覧と、その先頭addressを`lui`/`addiu`で返す関数の命令位置。 */
const LISTS = [
  { addiu: 0x1dd848, address: 0x2858c0, lui: 0x1dd840, name: "表A" },
  { addiu: 0x1dd838, address: 0x285980, lui: 0x1dd830, name: "表B" },
] as const;
/** 一覧を辿る関数が飛ばすrowを持つ`li`。rowは0〜3なので4なら飛ばさない */
const ROW_SKIPS = [
  { address: 0x19706c, name: "表A" },
  { address: 0x196fcc, name: "表B" },
] as const;
const SKIPPED_ROW = 3;
const NO_ROW = 4;

/** 表A・表Bの一覧をこの順に詰めたint16の並びと、それぞれの先頭のhalf位置 */
export function unlockListHalves(
  songs: number,
): { halves: number[]; starts: number[] } {
  assert(Number.isInteger(songs) && songs > 0, "曲数は正の整数");
  const halves: number[] = [];
  const starts = LISTS.map(() => {
    // `lui`/`addiu`で返す先頭は4バイト境界に揃える
    if (halves.length % 2 !== 0) halves.push(0);
    const start = halves.length;
    halves.push(...Array.from({ length: songs }, (_, index) => index));
    halves.push(TERMINATOR);
    return start;
  });
  return { halves, starts };
}

function patchOf(
  elf: MutableElf,
  address: number,
  immediate: number,
  row: Pick<
    InstructionPatch,
    "newReference" | "oldReference" | "rationale" | "referenceForm" | "usage"
  >,
): InstructionPatch {
  const oldWord = requireWord(elf, address);
  return {
    ...row,
    action: UNLOCK_LIST_ACTION,
    address,
    functionName: "",
    newWord: withImmediate(oldWord, immediate),
    oldWord,
    sourceAddress: hex(address),
  };
}

/** 一覧を`base`から置いたときの、返り値の差し替えと黒ANOTHERの除外の解除 */
export function unlockListPatches(
  elf: MutableElf,
  base: number,
  starts: readonly number[],
): InstructionPatch[] {
  const listPatches = LISTS.flatMap((list, index) => {
    const target = base + starts[index] * 2;
    const shared = {
      newReference: hex(target),
      oldReference: hex(list.address),
      rationale: `${list.name}の既定解禁一覧を全曲の写しへ向ける`,
      usage: "unlock_list",
    };
    const targetHigh = ((target + 0x8000) >>> 16) & 0xffff;
    return [
      patchOf(elf, list.lui, targetHigh, { ...shared, referenceForm: "lui" }),
      patchOf(elf, list.addiu, target & 0xffff, {
        ...shared,
        referenceForm: "addiu",
      }),
    ];
  });
  const rowPatches = ROW_SKIPS.map((skip) => {
    assert(
      immOf(requireWord(elf, skip.address)) === SKIPPED_ROW,
      `${skip.name}の飛ばすrowが${SKIPPED_ROW}でない`,
    );
    return patchOf(elf, skip.address, NO_ROW, {
      newReference: hex(NO_ROW),
      oldReference: hex(SKIPPED_ROW),
      rationale: `${skip.name}の既定解禁で黒ANOTHERのrowも立てる`,
      referenceForm: "li",
      usage: "unlock_row",
    });
  });
  return [...listPatches, ...rowPatches];
}
