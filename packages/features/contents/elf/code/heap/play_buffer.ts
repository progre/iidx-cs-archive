/**
 * 演奏画面バッファの大きいほうを広げる。
 * `FUN_0013a410`は、曲DB`+0xBC`の`0x100`のbitが立つ曲で、`0x708000`に`0x600000`を足して`0xD08000`を確保する。
 * キー音バンクはこのバッファに読み込まれ、djt・goldには`0xD08000`を超えるバンクがある。
 * 超えた分は割当器の領域の後ろ(スタック)を上書きする。そこで、足す値を広げる。
 * 広げた大きさは、最も大きいバンク(約13.6MiB)に、小さいほうのバッファ1つ分の余裕を足したものである。
 * ヒープは`extend.ts`で約117MiBに広げてあるので、この大きさを確保できる。
 */

import { type MutableElf, overwriteCode } from "../../elf/mod.ts";
import { lui, reg } from "../mips/mod.ts";

/** bitの立つ曲の演奏画面バッファの大きさ */
const LARGE_PLAY_BUFFER = 0x1708000;
const SMALL_PLAY_BUFFER = 0x708000;
/** `lui v0,0x60`。`0x708000`に足す値の上位16bitを作る */
const ADD_VADDR = 0x13a434;

export function enlargePlayBuffer(elf: MutableElf): void {
  const original = lui(reg.v0, 0x60);
  if (elf.u32(ADD_VADDR) !== original) {
    throw new Error("演奏画面バッファの大きさを作る命令が原盤と違う");
  }
  overwriteCode(elf, ADD_VADDR, [
    lui(reg.v0, (LARGE_PLAY_BUFFER - SMALL_PLAY_BUFFER) >>> 16),
  ]);
}
