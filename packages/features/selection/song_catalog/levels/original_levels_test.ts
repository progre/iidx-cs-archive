import { assertEquals } from "@std/assert";
import { originalLevelsOf } from "./difficulty_names.ts";

const LEVEL_CHARTS = [["sp_hyper", "dp_hyper"], ["sp_normal"], []];

const raw = (levels: number[], beginnerLevel: number | null = null) => ({
  levels,
  beginnerLevel,
});

Deno.test("欄ごとに並べた難易度へ、その欄の値を持たせる", () => {
  assertEquals(
    originalLevelsOf(LEVEL_CHARTS, raw([6, 3, 9])),
    { sh: 6, dh: 6, sn: 3 },
  );
});

Deno.test("初心者は別の欄から読む", () => {
  assertEquals(originalLevelsOf(LEVEL_CHARTS, raw([6, 3], 2)), {
    sh: 6,
    dh: 6,
    sn: 3,
    sb: 2,
  });
});

Deno.test("値が0の欄と、並びが無い欄は持たない", () => {
  assertEquals(originalLevelsOf(LEVEL_CHARTS, raw([0, 0, 0])), {});
  assertEquals(originalLevelsOf([], raw([5, 5])), {});
});
