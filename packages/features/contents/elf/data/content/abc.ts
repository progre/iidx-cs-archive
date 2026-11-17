/**
 * ABC表の書き換え。既存の行には従来のindex境界で決まるタグを付け、
 * 新しく足す行には絶対LBA・セクタ数・バイト数を書く。
 */

import type { MutableElf } from "../../elf/mod.ts";
import type { AbcEntry } from "../../model/mod.ts";
import { CANARY, PB_ABC_COUNT } from "../segment/mod.ts";

/** ABC表`+0`の上位2bitがタグ、下位30bitがアーカイブ内のセクタ位置。 */
export const TAG_SHIFT = 30;
export const OFFSET_MASK = 0x3fffffff;
/** 基底LBA配列の要素3は使われていないので、タグ3を絶対LBAの印にする。 */
export const TAG_ABSOLUTE = 3;
const ABC_ROW = 12;

/** 既存の行のタグ。従来のindex境界でA・B・Cを選ぶ。 */
export const legacyTagOf = (index: number): number =>
  index < 0x38 ? 0 : index < 0x3a2 ? 1 : 2;

export function writeAbcTable(
  elf: MutableElf,
  abcVaddr: number,
  entries: readonly AbcEntry[],
): void {
  for (let index = 0; index < PB_ABC_COUNT; index++) {
    const address = abcVaddr + index * ABC_ROW;
    const offset = elf.u32(address);
    if ((offset & ~OFFSET_MASK) !== 0) {
      throw new Error(`既存のABC[${index}]の上位bitが非ゼロ`);
    }
    elf.setU32(address, (legacyTagOf(index) << TAG_SHIFT) | offset);
  }
  for (const entry of entries) {
    const address = abcVaddr + entry.newAbcIndex * ABC_ROW;
    if (!elf.slice(address, ABC_ROW).every((byte) => byte === CANARY)) {
      throw new Error(`新しいABC[${entry.newAbcIndex}]の書込み先が空でない`);
    }
    elf.setU32(address, ((TAG_ABSOLUTE << TAG_SHIFT) | entry.lba) >>> 0);
    elf.setU32(address + 4, entry.sectors);
    elf.setU32(address + 8, entry.sourceSize);
  }
}

export function verifyAbcTable(
  elf: MutableElf,
  abcVaddr: number,
  entries: readonly AbcEntry[],
): void {
  const seen = new Set<number>();
  for (const entry of entries) {
    if (seen.has(entry.newAbcIndex)) {
      throw new Error(`ABC indexが重複する: ${entry.newAbcIndex}`);
    }
    seen.add(entry.newAbcIndex);
    const address = abcVaddr + entry.newAbcIndex * ABC_ROW;
    const tagged = elf.u32(address);
    if (
      tagged >>> TAG_SHIFT !== TAG_ABSOLUTE ||
      (tagged & OFFSET_MASK) !== entry.lba ||
      elf.u32(address + 4) !== entry.sectors ||
      elf.u32(address + 8) !== entry.sourceSize
    ) {
      throw new Error(`ABC[${entry.newAbcIndex}]の行が読み戻せない`);
    }
  }
}
