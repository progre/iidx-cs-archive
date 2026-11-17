import { assertEquals, assertThrows } from "@std/assert";
import { existingChartsOf } from "./difficulty_names.ts";
import { chartOfName } from "./difficulty_names.ts";

const SLOTS = ["sp_hyper", "dp_hyper", "sp_normal", "dp_beginner", "sp_black"];

Deno.test("難易度名を全曲リストの列名に直す", () => {
  assertEquals(SLOTS.map(chartOfName), ["sh", "dh", "sn", "db", "sl"]);
  assertThrows(() => chartOfName("sp_unknown"), Error, "sp_unknown");
});

Deno.test("0と0xffffffffのスロットは譜面が無い", () => {
  assertEquals(
    existingChartsOf(SLOTS, [740, 0, 0xffffffff, 743]),
    ["sh", "db"],
  );
});

Deno.test("スロットの数を超えた値は読まない", () => {
  assertEquals(existingChartsOf(SLOTS.slice(0, 2), [1, 2, 3]), ["sh", "dh"]);
});
