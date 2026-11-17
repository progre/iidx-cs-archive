/**
 * crt0のスレッドとヒープの設定にある`-1`を、明示の値へ置き換える。
 * これでスタックとヒープの終端が128MB RAMの末尾へ移る。
 * 市販カーネルは128MBを報告しない。
 * そのため、`-1`のままではヒープが32MB内に留まる。
 */

import { type MutableElf, overwriteCode } from "../../elf/mod.ts";
import { addiu, lui, NOP, reg } from "../mips/mod.ts";

export const RAM_END = 0x8000000;
export const STACK_SIZE = 0x100000;
export const STACK_BASE = RAM_END - STACK_SIZE;
const HEAP_START = 0x7c9680;
const HEAP_SIZE = STACK_BASE - HEAP_START;

/** vaddrと新しい命令語。`lui`と`addiu`の組が`-1`を作っている */
const PATCHES: readonly (readonly [number, number])[] = [
  [0x10019c, lui(reg.a1, STACK_BASE >>> 16)],
  [0x1001b0, addiu(reg.a1, reg.a1, STACK_BASE & 0xffff)],
  [0x1001d4, lui(reg.a1, HEAP_SIZE >>> 16)],
  [0x1001dc, addiu(reg.a1, reg.a1, HEAP_SIZE & 0xffff)],
  // ヒープ終端を返すsyscallは、明示サイズを32MB内へ切り詰める。
  // そのため、stub側で定数にする。
  [0x10ec40, lui(reg.v0, STACK_BASE >>> 16)],
  [0x10ec44, NOP],
  // 割当器の初期化が見る総量の即値を128MBにする
  [0x152de4, lui(reg.a0, RAM_END >>> 16)],
  // 総量が128MBのとき、割当器は第2領域を作る経路を通る。
  // 第1領域が119MBになる構成では、この経路の確保が失敗して不定になる。
  // そのため、比較値を0にしてこの経路を通さない。
  [0x152eb0, lui(reg.a0, 0)],
  [0x152fb0, lui(reg.v0, 0)],
  [0x153024, lui(reg.v0, 0)],
];

export function extendHeap(elf: MutableElf): void {
  PATCHES.forEach(([vaddr, word]) => overwriteCode(elf, vaddr, [word]));
}
