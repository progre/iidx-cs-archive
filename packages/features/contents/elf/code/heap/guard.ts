/**
 * 割当器の確保失敗ハンドラー(空関数)を、要求サイズと呼び出し元を固定番地へ書いて
 * 止まるstubへ差し替える。失敗時に0が返ってアドレス0へ書き込む代わりにここで止まるので、
 * どの確保が何バイトで失敗したかは、エミュレーターのステートを調べると分かる。
 */

import type { MutableElf } from "../../elf/mod.ts";
import { beq, lui, NOP, ori, reg, sw } from "../mips/mod.ts";
import { STUB_SLOTS } from "../../data/stub_area/mod.ts";
import { writeSlot } from "../stubs/mod.ts";

const CODE_SLOT = STUB_SLOTS.heapGuardCode;
const DATA_SLOT = STUB_SLOTS.heapGuardData;
export const GUARD_DATA = DATA_SLOT.vaddr;
export const GUARD_MARK = 0xdeadbeef;
/** 下位vtableの確保失敗ハンドラーの欄 */
const HANDLER_SLOT = 0x2af6d0 + 0x64;
const DATA_BYTES = 0x14;

/** `sw`の即値は符号付きなので、luiは丸めた上位を使い下位は負の値で届かせる */
const DATA_HIGH = (GUARD_DATA + 0x8000) >>> 16;
const DATA_LOW = GUARD_DATA - (DATA_HIGH << 16);

/** 停止時に書く値。ハンドラーはここで要求サイズとフレームを受け取っている */
const GUARD_WORDS = [
  lui(reg.at, DATA_HIGH),
  sw(reg.s2, DATA_LOW + 0x0, reg.at),
  sw(reg.ra, DATA_LOW + 0x4, reg.at),
  sw(reg.sp, DATA_LOW + 0x8, reg.at),
  sw(reg.a0, DATA_LOW + 0xc, reg.at),
  lui(reg.v0, GUARD_MARK >>> 16),
  ori(reg.v0, reg.v0, GUARD_MARK & 0xffff),
  sw(reg.v0, DATA_LOW + 0x10, reg.at),
  // その場で回り続ける
  beq(reg.zero, reg.zero, -1),
  NOP,
];

export function applyHeapGuard(elf: MutableElf): void {
  writeSlot(elf, CODE_SLOT, GUARD_WORDS);
  // 記録の欄は0のまま使う。
  // 0を書くのは、他の書き込みと置き場が重なっていないことを確かめるためである。
  writeSlot(elf, DATA_SLOT, new Array(DATA_BYTES / 4).fill(0));
  elf.setU32(HANDLER_SLOT, CODE_SLOT.vaddr);
}
