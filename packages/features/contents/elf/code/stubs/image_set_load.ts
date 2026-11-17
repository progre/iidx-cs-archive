/**
 * 選曲画面は`.if`のDATA1 index一覧を辿り、1本ずつ読み込む。
 * 一覧は-1で終わる。
 * 一覧はシーン構造体の内側にあるので、延長できない。
 * そこで、読み込みの呼び出しをstubへ向ける。
 * stubは、大きい曲名画像セットを読んだ直後に、高位PT_LOADの表を続けて読む。
 * 表は追加画像セットのindexを並べたもので、-1で終わる。
 */

import { type MutableElf, overwriteCode } from "../../elf/mod.ts";
import {
  addiu,
  assemble,
  beq,
  bne,
  branchTo,
  daddu,
  jal,
  jr,
  ld,
  lui,
  lw,
  mark,
  NOP,
  ori,
  reg,
  sd,
} from "../mips/mod.ts";
import { STUB_SLOTS } from "../../data/stub_area/mod.ts";
import { writeSlot } from "./area.ts";

/** 読み込みの呼び出しと、読み込み本体 */
const LOAD_SITE = 0x155be4;
const LOAD_IF = 0x136190;
/**
 * 原盤の大きい曲名画像セットのDATA1 indexである。
 * 表を挟み込む位置は、このindexで決まる。
 */
const BIG_TITLE_IMAGE_SET = 1313;
const CODE_SLOT = STUB_SLOTS.imageSetLoadCode;
const TABLE_SLOT = STUB_SLOTS.imageSetLoadTable;
const EXTRA_LOAD_STUB = CODE_SLOT.vaddr;
const EXTRA_LOAD_TABLE = TABLE_SLOT.vaddr;
const FRAME = 0x20;
const RA_SLOT = 0x10;

/** 一覧の終端。読み込む表も同じ値で終わる */
const TERMINATOR = -1;

function stubWords(): number[] {
  return assemble([
    addiu(reg.sp, reg.sp, -FRAME),
    sd(reg.ra, RA_SLOT, reg.sp),
    sd(reg.s0, 0, reg.sp),
    // a0は読むDATA1 index。呼び出し側の遅延スロットが積む
    daddu(reg.s0, reg.a0, reg.zero),
    jal(LOAD_IF),
    NOP,
    addiu(reg.v0, reg.zero, BIG_TITLE_IMAGE_SET),
    branchTo(bne(reg.s0, reg.v0, 0), "done"),
    NOP,
    lui(reg.s0, EXTRA_LOAD_TABLE >>> 16),
    // 下位が0x8000以上でもゼロ拡張の`ori`なら届く
    ori(reg.s0, reg.s0, EXTRA_LOAD_TABLE & 0xffff),
    mark("next"),
    lw(reg.a0, 0, reg.s0),
    addiu(reg.v0, reg.zero, TERMINATOR),
    branchTo(beq(reg.a0, reg.v0, 0), "done"),
    NOP,
    jal(LOAD_IF),
    NOP,
    branchTo(beq(reg.zero, reg.zero, 0), "next"),
    addiu(reg.s0, reg.s0, 4),
    mark("done"),
    ld(reg.ra, RA_SLOT, reg.sp),
    ld(reg.s0, 0, reg.sp),
    jr(reg.ra),
    addiu(reg.sp, reg.sp, FRAME),
  ]);
}

/** 追加画像セットが無ければ何も書かない */
export function writeExtraImageSetLoad(
  elf: MutableElf,
  extraIndices: readonly number[],
): void {
  if (extraIndices.length === 0) return;
  writeSlot(elf, TABLE_SLOT, [...extraIndices, TERMINATOR >>> 0]);
  writeSlot(elf, CODE_SLOT, stubWords());
  overwriteCode(elf, LOAD_SITE, [jal(EXTRA_LOAD_STUB)]);
}

export function verifyExtraImageSetLoad(
  elf: MutableElf,
  extraIndices: readonly number[],
): void {
  if (extraIndices.length === 0) {
    if (elf.u32(LOAD_SITE) !== jal(LOAD_IF)) {
      throw new Error("追加画像セットが無いのに読み込み元が差し替わっている");
    }
    return;
  }
  if (elf.u32(LOAD_SITE) !== jal(EXTRA_LOAD_STUB)) {
    throw new Error("読み込み元がstubを指していない");
  }
  extraIndices.forEach((index, slot) => {
    if (elf.u32(EXTRA_LOAD_TABLE + slot * 4) !== index) {
      throw new Error(`追加画像セットの表[${slot}]が${index}でない`);
    }
  });
  if (
    elf.u32(EXTRA_LOAD_TABLE + extraIndices.length * 4) !== TERMINATOR >>> 0
  ) {
    throw new Error("追加画像セットの表が-1で終わっていない");
  }
}
