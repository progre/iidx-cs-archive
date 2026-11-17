// 版どうしの譜面の比べ方を、譜面の形を自分で組み立てて見る。原盤は読まない。
import {
  assert,
  assertAlmostEquals,
  assertEquals,
  assertFalse,
} from "@std/assert";
import type { ChartShape } from "@csa/core";
import { compareShape, sameShape } from "./shape_compare.ts";

/** 1P の鍵盤1〜3を、40 tick おきに順に押す。`[tick, 鍵盤]`を並べる */
const NOTES = Array.from(
  { length: 30 },
  (_, i) => [100 + i * 40, 1 + i % 3],
);
const shapeOf = (notes: number[][]): ChartShape => ({
  keys: Object.fromEntries(
    [...Map.groupBy(notes, ([, key]) => `0.${key}`)].map((
      [key, grouped],
    ) => [key, grouped.map(([tick]) => tick).sort((a, b) => a - b)]),
  ),
});
/** tick を`scale`倍して丸める */
const scaled = (scale: number) =>
  NOTES.map(([tick, key]) => [Math.round(tick * scale), key]);
/** 11番目のノーツだけ、別の鍵盤へ移す */
const moved = NOTES.map((note, i) => i === 10 ? [note[0], 7] : note);

Deno.test("テンポがわずかに違い、tick が丸めでずれても、同じ譜面とみなす", () => {
  assert(sameShape(shapeOf(NOTES), shapeOf(scaled(1.004))));
});

Deno.test("1つのノーツの鍵盤が違えば、違う譜面とみなす", () => {
  assertFalse(sameShape(shapeOf(NOTES), shapeOf(moved)));
});

Deno.test("BPM が違う(縮尺が1%を超えて違う)譜面は、違う譜面とみなす", () => {
  assertFalse(sameShape(shapeOf(NOTES), shapeOf(scaled(1.11))));
});

Deno.test("比べた結果は、同じ譜面なら一致割合 1 になる", () => {
  assertEquals(compareShape(shapeOf(NOTES), shapeOf(NOTES)), 1);
});

Deno.test("時刻が少しずれたノーツがあれば、一致割合は時刻の差が1以内のノーツの割合になる", () => {
  const shifted = NOTES.map(([tick, key], i) =>
    i < 3 ? [tick + 3, key] : [tick, key]
  );
  assertAlmostEquals(
    compareShape(shapeOf(NOTES), shapeOf(shifted)) as number,
    0.9,
    0.001,
  );
});

Deno.test("鍵盤ごとのノーツ数が違えば、配置不一致になる", () => {
  assertEquals(compareShape(shapeOf(NOTES), shapeOf(moved)), "layout");
});

Deno.test("縮尺が1%を超えて違えば、BPM不一致になる", () => {
  assertEquals(compareShape(shapeOf(NOTES), shapeOf(scaled(1.11))), "bpm");
});
