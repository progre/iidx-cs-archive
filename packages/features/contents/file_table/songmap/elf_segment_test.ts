import { assertEquals } from "@std/assert";
import { elfSegmentOf, segmentOf } from "./elf_segment.ts";

const elf = Uint8Array.from({ length: 10 }, (_, i) => i);

Deno.test("実行ファイルにあるファイルは名前の大文字小文字を問わず切り出す", async () => {
  const file = { archive: "slps_123.45", offset: 1, size: 2 };
  const read = () => Promise.reject(new Error("読まない"));
  assertEquals([...await segmentOf(elf, "SLPS_123.45", file, read)], [1, 2]);
});

Deno.test("他のアーカイブのファイルは読み出し関数の結果を返す", async () => {
  const file = { archive: "DATA1.DAT", offset: 1, size: 2 };
  const read = () => Promise.resolve(Uint8Array.of(9));
  assertEquals([...await segmentOf(elf, "SLPS_123.45", file, read)], [9]);
});

Deno.test("大きさが正なら、その範囲を返す", () => {
  assertEquals([...elfSegmentOf(elf, { offset: 2, size: 3 })], [2, 3, 4]);
});

Deno.test("大きさが負なら、末尾まで返す", () => {
  assertEquals([...elfSegmentOf(elf, { offset: 7, size: -100 })], [7, 8, 9]);
});

Deno.test("ELFを超える大きさは、末尾で切る", () => {
  assertEquals([...elfSegmentOf(elf, { offset: 8, size: 50 })], [8, 9]);
});
