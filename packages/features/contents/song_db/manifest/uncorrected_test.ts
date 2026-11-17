// 補正前の値の残し方。ファイルを読まず、組み立てたエントリーで確かめる。

import { assertEquals } from "@std/assert";
import { PB_FORMAT as PB_ENTRY } from "../pb/mod.ts";
import { uncorrectedOf } from "./uncorrected.ts";

function entryWith(levels: Record<string, number>): Uint8Array {
  const entry = new Uint8Array(PB_ENTRY.size);
  for (const [name, level] of Object.entries(levels)) {
    entry[PB_ENTRY.levelFieldOffset(name)] = level;
  }
  return entry;
}

Deno.test("補正で変わらなければ、補正前の値を持たない", () => {
  const entry = entryWith({ sp_normal: 3 });
  assertEquals(uncorrectedOf(PB_ENTRY, entry, entry, undefined, 10), undefined);
  assertEquals(uncorrectedOf(PB_ENTRY, entry, entry, 10, 10), undefined);
});

Deno.test("補正で変わったレベルだけ、補正前の値を持つ", () => {
  const before = entryWith({ sp_beginner: 5, sp_normal: 3 });
  const after = entryWith({ sp_beginner: 3, sp_normal: 3 });
  assertEquals(uncorrectedOf(PB_ENTRY, before, after, undefined, 10), {
    levels: { sp_beginner: 5 },
  });
});

Deno.test("folder列で変えた作品番号は、規則が決める値を持つ", () => {
  const entry = entryWith({});
  assertEquals(uncorrectedOf(PB_ENTRY, entry, entry, 8, 10), { version: 8 });
  assertEquals(uncorrectedOf(PB_ENTRY, entry, entry, null, 10), {
    version: null,
  });
});
