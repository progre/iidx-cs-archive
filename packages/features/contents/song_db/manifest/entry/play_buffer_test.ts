// 演奏画面バッファの大きさを選ぶ印。組み立てたエントリーで確かめる。

import { assertEquals } from "@std/assert";
import { PB_FORMAT as PB_ENTRY } from "../../pb/mod.ts";
import { withPlayBuffer } from "./play_buffer.ts";

const bcOf = (text: string) =>
  PB_ENTRY.recordOf(PB_ENTRY.decode(text)).artwork.unkPbBc;

const entryWith = (bc: number) => {
  const entry = new Uint8Array(PB_ENTRY.size);
  PB_ENTRY.recordOf(entry).artwork.unkPbBc = bc;
  return PB_ENTRY.encode(entry);
};

Deno.test("キー音バンクが小さいバッファーに収まらなければ、0x100のbitを立てる", () => {
  assertEquals(bcOf(withPlayBuffer(PB_ENTRY, entryWith(0x1), 0x708001)), 0x101);
});

Deno.test("キー音バンクが小さいバッファーに収まれば、欄を変えない", () => {
  assertEquals(bcOf(withPlayBuffer(PB_ENTRY, entryWith(0x1), 0x708000)), 0x1);
  assertEquals(bcOf(withPlayBuffer(PB_ENTRY, entryWith(0x100), 0x10)), 0x100);
});
