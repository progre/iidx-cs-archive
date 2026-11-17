/**
 * ABC表`+0`をタグ付きのセクタ位置として読むローダーの差し替え。
 * 同期と非同期の読み込みの先頭を、従来のindex境界の分岐からタグの取り出しへ置き換える。
 */

import { type MutableElf, overwriteCode } from "../../elf/mod.ts";
import {
  addiu,
  addu,
  and,
  jr,
  lw,
  NOP,
  pairWords,
  reg,
  sll,
  sltiu,
  srl,
  subu,
  sw,
} from "../mips/mod.ts";
import { TAG_ABSOLUTE, TAG_SHIFT } from "../../data/content/mod.ts";

const SYNC_START = 0x14cec0;
const ASYNC_START = 0x14d100;
/** 置き換える語数。余りはNOPで潰す */
const SYNC_WORDS = 29;
const ASYNC_WORDS = 41;
/** 基底LBA配列と、同期の読み込みが結果を書く配列 */
const BASE_TABLE = 0x78fde4;
const SYNC_RESULT = 0x7905f0;
const ABSOLUTE_TAG_BYTE_OFFSET = TAG_ABSOLUTE * 4;

/** `tagOffset`(tag*4)がタグ3なら`base`を0にする。分岐を使わず3語で済ます */
function zeroBaseForAbsoluteTag(base: number, tagOffset: number): number[] {
  return [
    sltiu(tagOffset, tagOffset, ABSOLUTE_TAG_BYTE_OFFSET),
    subu(tagOffset, reg.zero, tagOffset),
    and(base, base, tagOffset),
  ];
}

function syncWords(abcVaddr: number): number[] {
  const [hi, lo] = pairWords(reg.a0, abcVaddr);
  return [
    sll(reg.v1, reg.a0, 2),
    sll(reg.a2, reg.a1, 1),
    addu(reg.a2, reg.a2, reg.a1),
    sll(reg.a2, reg.a2, 2),
    hi,
    lo,
    addu(reg.a0, reg.a0, reg.a2),
    lw(reg.a2, 0, reg.a0),
    srl(reg.a1, reg.a2, TAG_SHIFT),
    sll(reg.a1, reg.a1, 2),
    sll(reg.a2, reg.a2, 2),
    srl(reg.a2, reg.a2, 2),
    ...pairWords(reg.a0, BASE_TABLE),
    addu(reg.a0, reg.a0, reg.a1),
    lw(reg.a0, 0, reg.a0),
    ...zeroBaseForAbsoluteTag(reg.a0, reg.a1),
    addu(reg.a0, reg.a0, reg.a2),
    ...pairWords(reg.a1, SYNC_RESULT),
    addu(reg.v1, reg.v1, reg.a1),
    sw(reg.a0, 0x0c, reg.v1),
    jr(reg.ra),
    NOP,
  ];
}

function asyncWords(abcVaddr: number): number[] {
  const [hi, lo] = pairWords(reg.t1, abcVaddr);
  return [
    sw(reg.a3, 0x10, reg.t2),
    addiu(reg.v1, reg.t2, 0x0c),
    sw(reg.a1, 0x14, reg.t2),
    sw(reg.zero, 0x18, reg.t2),
    sll(reg.a2, reg.a0, 1),
    addu(reg.a2, reg.a2, reg.a0),
    sll(reg.a2, reg.a2, 2),
    hi,
    lo,
    addu(reg.t1, reg.t1, reg.a2),
    lw(reg.a3, 0, reg.t1),
    lw(reg.a1, 4, reg.t1),
    lw(reg.a0, 8, reg.t1),
    srl(reg.a2, reg.a3, TAG_SHIFT),
    sll(reg.a2, reg.a2, 2),
    sll(reg.a3, reg.a3, 2),
    srl(reg.a3, reg.a3, 2),
    ...pairWords(reg.t0, BASE_TABLE),
    addu(reg.t0, reg.t0, reg.a2),
    lw(reg.t0, 0, reg.t0),
    ...zeroBaseForAbsoluteTag(reg.t0, reg.a2),
    addu(reg.t0, reg.t0, reg.a3),
    sw(reg.t0, 0x10, reg.v1),
    sw(reg.a1, 0x14, reg.v1),
    sw(reg.a0, 0x18, reg.v1),
    jr(reg.ra),
    NOP,
  ];
}

export function writeLoaderStubs(elf: MutableElf, abcVaddr: number): void {
  overwriteCode(elf, SYNC_START, syncWords(abcVaddr), SYNC_WORDS);
  overwriteCode(elf, ASYNC_START, asyncWords(abcVaddr), ASYNC_WORDS);
}
