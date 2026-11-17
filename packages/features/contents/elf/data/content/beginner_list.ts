/**
 * 選曲画面のBEGINNERの一覧に、BEGINNERの譜面だけを持つ曲も載るようにする。
 * 原盤の一覧は、BEGINNER以外の難易度とSP NORMALにレベルがある曲だけを載せる。
 * 原盤は、条件を満たさない曲のレベルを1つの命令で-1にしている。
 * この命令を無効にすると、一覧に載るかはSP BEGINNERのレベルだけで決まる。
 */

import { type MutableElf, overwriteCode } from "../../elf/mod.ts";
import { NOP } from "../../code/mips/mod.ts";

/** `FUN_0020f770`の`li s3,-0x1` */
const LEVEL_RESET = 0x20f7f0;
const LEVEL_RESET_WORD = 0x2413ffff;

export function writeBeginnerList(elf: MutableElf): void {
  if (elf.u32(LEVEL_RESET) !== LEVEL_RESET_WORD) {
    throw new Error("BEGINNERの一覧の判定が、原盤の命令と違う");
  }
  overwriteCode(elf, LEVEL_RESET, [], 1);
}

export function verifyBeginnerList(elf: MutableElf): void {
  if (elf.u32(LEVEL_RESET) !== NOP) {
    throw new Error("BEGINNERの一覧の判定が潰れていない");
  }
}
