import { assertEquals } from "@std/assert";
import { era1LevelOf } from "./level.ts";

const GAIN = 92;
const PB_CENTER = 80;

/** PBの片側の大きさを、era1と同じ単位(BGMの片側を126 × str_volumeとする)に直す */
const pbSide = (volume: number, pan: number) =>
  ((volume * 255) >> 8) * pan * (GAIN << 7) / (127 * 128);

const near = (actual: number, expected: number) =>
  Math.abs(actual / expected - 1) < 0.02;

Deno.test("モノラルの中央付近は、左右それぞれが原作の2%以内に収まる", () => {
  // 原作の定位64は、左が 2 × 31、右が 2 × 32 を掛ける
  const level = era1LevelOf({ ch: 1, pan: 64, volume: 127 }, GAIN);
  assertEquals(near(pbSide(level.volume, PB_CENTER), 127 * 62), true);
  assertEquals(near(pbSide(level.volume, PB_CENTER), 127 * 64), true);
});

Deno.test("左いっぱいのモノラルは、PBでも左いっぱいに置く", () => {
  assertEquals(era1LevelOf({ ch: 1, pan: 0, volume: 100 }, GAIN).pan, 1);
});

Deno.test("ステレオは定位を変えず、音量だけを直す", () => {
  const level = era1LevelOf({ ch: 2, pan: 64, volume: 100 }, GAIN);
  assertEquals(level.pan, null);
  assertEquals(near(pbSide(level.volume, 127), 100 * 63), true);
});

Deno.test("音量0は0のまま", () => {
  assertEquals(era1LevelOf({ ch: 1, pan: 30, volume: 0 }, GAIN).volume, 0);
});
