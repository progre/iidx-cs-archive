/**
 * 曲数から決まる即値の書き換えと、選曲項目コードを符号なしで読む差し替えを作る。
 * 原盤の即値はELFから読んだ値を使い、定数で持たない。
 */

import {
  type InstructionPatch,
  type MutableElf,
  requireWord,
} from "../../../elf/mod.ts";
import { immOf, opOf, withImmediate } from "../../mips/mod.ts";
import { PB_SONG_COUNT, type SongCapacity } from "../../../model/mod.ts";
import { FILL_LIMIT_SITES, SHIFT_SITES } from "./shifts.ts";

export const SONG_COUNT_ACTION = "song_count";
/**
 * 曲数を判定する即値のうち、ここでは曲数へ広げない2件。
 * スコア変動の表を初期化するループの上限である。
 * 2本の配列のうち、0x1735ccの配列は広げない。0x173634の配列は`code/ghost_table/`が広げる。
 */
const EXCLUDED_IMMEDIATES = new Set([0x1735cc, 0x173634]);
export const SELECTION_ITEM_LBU_ACTION = "selection_item_lbu";
const LB_OPCODE = 0x20;
const LBU_OPCODE = 0x24;

const hex = (value: number) => "0x" + (value >>> 0).toString(16);

function immediateRow(
  elf: MutableElf,
  address: number,
  immediate: number,
  usage: string,
): InstructionPatch {
  const oldWord = requireWord(elf, address);
  return {
    action: SONG_COUNT_ACTION,
    address,
    functionName: "",
    newReference: hex(immediate),
    newWord: withImmediate(oldWord, immediate & 0xffff),
    oldReference: hex(immOf(oldWord)),
    oldWord,
    rationale: "曲数の窓を広げた",
    referenceForm: "immediate",
    sourceAddress: hex(address),
    usage,
  };
}

/**
 * 曲数を判定する即値と、その直後に並ぶ選曲の特殊値、候補曲indexリストの埋戻し上限。
 * 特殊値は原盤の即値に曲数の差を掛けて動かす。
 */
export function buildSongCountPatches(
  elf: MutableElf,
  capacity: SongCapacity,
  immediates: readonly number[],
): InstructionPatch[] {
  const grown = capacity.songCount - PB_SONG_COUNT;
  const rows = immediates
    .filter((address) => !EXCLUDED_IMMEDIATES.has(address))
    .map((address) =>
      immediateRow(elf, address, capacity.songCount, "song_count")
    );
  if (rows.length !== immediates.length - EXCLUDED_IMMEDIATES.size) {
    throw new Error("曲数へ広げない即値が表に無い");
  }
  for (const site of SHIFT_SITES) {
    const current = immOf(requireWord(elf, site.address));
    rows.push(
      immediateRow(elf, site.address, current + grown * site.delta, "shift"),
    );
  }
  for (const address of FILL_LIMIT_SITES) {
    rows.push(
      immediateRow(elf, address, capacity.songCount + 1, "fill_limit"),
    );
  }
  return rows;
}

/** 選曲項目コードを読む`lb`を`lbu`にする。`lb`でない語を読んだら止める。 */
export function buildSelectionItemLbuPatches(
  elf: MutableElf,
  addresses: readonly number[],
): InstructionPatch[] {
  return addresses.map((address) => {
    const oldWord = requireWord(elf, address);
    if (opOf(oldWord) !== LB_OPCODE) {
      throw new Error(`${hex(address)}が\`lb\`ではない`);
    }
    return {
      action: SELECTION_ITEM_LBU_ACTION,
      address,
      functionName: "",
      newReference: "lbu",
      newWord: ((oldWord & ~(0x3f << 26)) | (LBU_OPCODE << 26)) >>> 0,
      oldReference: "lb",
      oldWord,
      rationale: "項目コードが128を超えるので符号なしで読む",
      referenceForm: "opcode",
      sourceAddress: hex(address),
      usage: "selection_item",
    };
  });
}
