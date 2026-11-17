import { assertEquals, assertThrows } from "@std/assert";
import { decodeLz } from "../pack/mod.ts";
import {
  buildLzStore,
  lzBinPath,
  lzIndexPath,
  lzIndexText,
  lzRowOf,
} from "./lz_store.ts";

const charts = new Map([
  [9, Uint8Array.of(9, 9, 9)],
  [2, Uint8Array.from({ length: 40 }, (_, i) => i * 3)],
]);

Deno.test("LZファイルの譜面は通し番号の昇順に並び、位置表を使って展開できる", () => {
  const { bin, index } = buildLzStore(charts);
  assertEquals(index.charts.map((row) => row.sourceFileIndex), [2, 9]);
  assertEquals(index.charts[0].offset, 0);
  assertEquals(index.charts[1].offset, index.charts[0].size);
  assertEquals(bin.length, index.charts[0].size + index.charts[1].size);
  for (const row of index.charts) {
    const lz = bin.subarray(row.offset, row.offset + row.size);
    assertEquals(decodeLz(lz), charts.get(row.sourceFileIndex));
    assertEquals(row.plainSize, charts.get(row.sourceFileIndex)?.length);
  }
});

Deno.test("LZファイルに無い番号を引くと失敗する", () => {
  const { index } = buildLzStore(charts);
  assertEquals(lzRowOf(index, "5th", 9).sourceFileIndex, 9);
  assertThrows(() => lzRowOf(index, "5th", 3));
});

Deno.test("LZファイルと位置表は、世代のフォルダーの下に置く", () => {
  assertEquals(lzBinPath("d", "5th"), "d/5th/chart_lz.bin");
  assertEquals(lzIndexPath("d", "5th"), "d/5th/chart_lz.json");
});

Deno.test("位置表は、字下げ2つのJSONに改行を足して書く", () => {
  const { index } = buildLzStore(new Map([[1, Uint8Array.of(1)]]));
  const text = lzIndexText(index);
  assertEquals(text.endsWith("}\n"), true);
  assertEquals(text.split("\n")[1].startsWith('  "charts"'), true);
  assertEquals(JSON.parse(text), index);
});
