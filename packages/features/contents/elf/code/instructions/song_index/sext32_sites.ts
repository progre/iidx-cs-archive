/**
 * `dsll32 rd, rt, 0x18` + `dsra32 rd, rd, 0x18` の組による8bit符号拡張のうち、
 * 曲index経路と確定した17組の `dsra32` を `dsrl32` に変える。
 * `lb` を `lbu` に変えても、同じ値にこの組が掛かれば符号が戻ってしまう。
 */

import {
  hexAddress,
  type InstructionPatch,
  type MutableElf,
  requireWord,
} from "../../../elf/mod.ts";
import { opOf, rdOf, REG_NAMES, rtOf, saOf } from "../../mips/mod.ts";

export const DSRL32_ACTION = "change_to_dsrl32";
const SHIFT_8BIT = 0x18;
const FN_DSLL32 = 0x3c;
const FN_DSRL32 = 0x3e;
const FN_DSRA32 = 0x3f;
/** 対の`dsra32`を探す範囲(命令数)。 */
const PAIR_REACH = 8;

/**
 * 曲index経路と確定した組。走査の分類は書込み一覧からの推定にとどまるため、
 * 分岐テーブル `0x287750` とスタック退避を手で追った結果をここに置き、ELFに突き合わせる。
 * `dsll32`は変えず、対の`dsra32`だけを零拡張にする。
 */
export const SIGN_EXTENSION_PAIRS: readonly (readonly [number, number])[] = [
  [0x211f18, 0x211f20],
  [0x211f7c, 0x211f90],
  [0x212000, 0x212014],
  [0x2120a4, 0x2120ac],
  [0x21211c, 0x212120],
  [0x21215c, 0x212164],
  [0x2121a8, 0x2121bc],
  [0x212204, 0x21220c],
  [0x212248, 0x212250],
  [0x21234c, 0x212354],
  [0x2126d4, 0x2126dc],
  [0x212d08, 0x212d10],
  [0x212d6c, 0x212d80],
  [0x212df0, 0x212e04],
  [0x212e90, 0x212e98],
  [0x212f1c, 0x212f28],
  [0x212f60, 0x212f68],
];

const STORE_OPS = [0x1f, 0x28, 0x29, 0x2a, 0x2b, 0x2c, 0x2d, 0x2e, 0x37, 0x39];
const NO_DEST_FN = [0x08, 0x0c, 0x0d, 0x18, 0x19, 0x1a, 0x1b];

/** 命令が書くレジスター番号。書かないなら-1。 */
function destinationOf(word: number): number {
  if (word === 0) return -1;
  const op = opOf(word);
  if (op === 0) {
    return NO_DEST_FN.includes(word & 0x3f) ? -1 : rdOf(word);
  }
  if (op <= 0x07 || (op >= 0x14 && op <= 0x17)) return -1;
  return STORE_OPS.includes(op) ? -1 : rtOf(word);
}

/** `shl`から対の`dsra32`を探す。間に宛先を潰す命令があれば組にしない。 */
function pairedShiftRight(elf: MutableElf, shl: number): number | null {
  const word = requireWord(elf, shl);
  if (opOf(word) !== 0 || (word & 0x3f) !== FN_DSLL32) return null;
  if (saOf(word) !== SHIFT_8BIT) return null;
  const destination = rdOf(word);
  for (let step = 1; step <= PAIR_REACH; step++) {
    const next = elf.wordAt(shl + step * 4);
    if (next === null) return null;
    if (
      opOf(next) === 0 && (next & 0x3f) === FN_DSRA32 &&
      saOf(next) === SHIFT_8BIT && rtOf(next) === destination
    ) {
      return shl + step * 4;
    }
    if (destinationOf(next) === destination) return null;
  }
  return null;
}

export function buildSongIndexSext32Patches(
  elf: MutableElf,
): InstructionPatch[] {
  return SIGN_EXTENSION_PAIRS.map(([shl, shr]) => {
    if (pairedShiftRight(elf, shl) !== shr) {
      throw new Error("走査で組にならない: " + hexAddress(shl));
    }
    const oldWord = requireWord(elf, shr);
    return {
      action: DSRL32_ACTION,
      address: shr,
      functionName: "",
      newReference: "8bit零拡張",
      newWord: ((oldWord & ~0x3f) | FN_DSRL32) >>> 0,
      oldReference: "8bit符号拡張",
      oldWord,
      rationale: "曲index128以上を負値にしない",
      referenceForm: "dsra32_to_dsrl32",
      sourceAddress: hexAddress(shl),
      usage: "曲index配列+0x1f8の値を" + REG_NAMES[rdOf(oldWord)] + "へ拡張",
    };
  });
}
