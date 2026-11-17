/** 原盤のコードをその場で差し替える書き込み。 */

import { NOP } from "../code/mips/mod.ts";
import type { MutableElf } from "./elf.ts";

/**
 * `start`から`length`語を`words`で差し替える。
 * `words`が`length`に足りない分はNOPで埋める。
 * `words`が`length`を超える場合は止める。
 */
export function overwriteCode(
  elf: MutableElf,
  start: number,
  words: readonly number[],
  length = words.length,
): void {
  if (words.length > length) {
    throw new Error(`0x${start.toString(16)}の差し替えが元の範囲を超える`);
  }
  for (let index = 0; index < length; index++) {
    elf.setU32(start + index * 4, words[index] ?? NOP);
  }
}
