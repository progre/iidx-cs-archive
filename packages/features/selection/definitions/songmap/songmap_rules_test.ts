import { assertEquals, assertThrows } from "@std/assert";
import { GENERATIONS } from "../generation/mod.ts";
import { songCountOf, songmapRuleOf } from "./songmap_rules.ts";

Deno.test("規則に件数があれば定義の件数より優先する", () => {
  assertEquals(songCountOf({ songCount: 10 }, 99), 10);
});

Deno.test("規則に件数が無ければ定義の件数を使う", () => {
  assertEquals(songCountOf({}, 99), 99);
});

Deno.test("曲DBを持つ16世代すべてに規則がある", () => {
  [...GENERATIONS, "pb"].forEach((generation) => {
    assertEquals(songmapRuleOf(generation).archiveOrder.length > 0, true);
  });
});

Deno.test("PBはEmpressと同じ読み方である", () => {
  assertEquals(songmapRuleOf("pb"), songmapRuleOf("emp"));
});

Deno.test("規則が無い世代はエラーになる", () => {
  assertThrows(() => songmapRuleOf("none"), Error, "規則が無い世代");
});
