/**
 * stub領域への書き込み。領域は確保時に0で埋めてあるので、書く前に空であることを見て
 * 追加コード同士の置き場が重なっていないことを確かめる。
 */

import type { MutableElf } from "../../elf/mod.ts";
import type { StubSlot } from "../../data/stub_area/mod.ts";

const FILL = 0x00;

function requireFits(slot: StubSlot, bytes: number): void {
  if (bytes > slot.bytes) {
    throw new Error(`${slot.name}が置き場を超える: ${bytes / 4}語`);
  }
}

/**
 * 置き場の先頭から語を書く。
 * 語が容量を超える場合は止める。
 * 置き場が空でない場合も止める。
 */
export function writeSlot(
  elf: MutableElf,
  slot: StubSlot,
  words: readonly number[],
): void {
  requireFits(slot, words.length * 4);
  requireEmpty(elf, slot.vaddr, words.length * 4);
  words.forEach((word, index) => elf.setU32(slot.vaddr + index * 4, word));
}

/** 置き場の先頭から並びを詰めたときの、各並びの先頭address */
export function packSlot(
  slot: StubSlot,
  blocks: readonly (readonly number[])[],
): number[] {
  const words = blocks.reduce((total, block) => total + block.length, 0);
  requireFits(slot, words * 4);
  return blocks.map((_, index) =>
    slot.vaddr +
    blocks.slice(0, index).reduce((total, block) => total + block.length, 0) *
      4
  );
}

/** 置き場へ書くたびに後ろへ詰める書き込み。書いた先頭addressを返す */
export function slotCursor(
  elf: MutableElf,
  slot: StubSlot,
): (words: readonly number[]) => number {
  let used = 0;
  return (words) => {
    const at = slot.vaddr + used;
    writeSlot(elf, { ...slot, bytes: slot.bytes - used, vaddr: at }, words);
    used += words.length * 4;
    return at;
  };
}

function requireEmpty(
  elf: MutableElf,
  vaddr: number,
  bytes: number,
): void {
  if (elf.slice(vaddr, bytes).some((byte) => byte !== FILL)) {
    throw new Error(`0x${vaddr.toString(16)}の置き場が空でない`);
  }
}

/** バイト列をLEの語の並びにする。表をそのまま置くのに使う。 */
export function wordsOf(bytes: Uint8Array): number[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return Array.from(
    { length: bytes.length / 4 },
    (_, index) => view.getUint32(index * 4, true),
  );
}
