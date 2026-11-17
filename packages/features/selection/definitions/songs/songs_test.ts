import { assertEquals } from "@std/assert";
import { chartSlotsOf } from "./chart_slots.ts";
import { levelChartsOf } from "./level_charts.ts";

Deno.test("usだけ、譜面の並びのHYPERとNORMALが入れ替わる", () => {
  assertEquals(chartSlotsOf("us").slice(0, 4), [
    "sp_normal",
    "dp_normal",
    "sp_hyper",
    "dp_hyper",
  ]);
  assertEquals(chartSlotsOf("pb").slice(0, 2), ["sp_hyper", "dp_hyper"]);
});

Deno.test("レベル欄の並びが無い世代は空", () => {
  assertEquals(levelChartsOf("unknown"), []);
});
