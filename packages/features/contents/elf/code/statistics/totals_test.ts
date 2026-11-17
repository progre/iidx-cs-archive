// Statistics画面の分母に足す値。ELFを読まず、組み立てた曲で確かめる。

import { assertEquals, assertThrows } from "@std/assert";
import { type StatisticsSong, totalAdjustments } from "./totals.ts";

const song = (saved: boolean, levels: StatisticsSong["levels"]) => ({
  levels,
  saved,
});

Deno.test("分母は、スコアを保存する譜面の数になるように足す", () => {
  const adds = totalAdjustments([
    song(true, { sp_normal: 3, sp_another: 9 }),
    song(true, { sp_hyper: 5 }),
    song(false, { sp_normal: 3, sp_another: 9 }),
  ]);
  // NORMALとHYPERは、ループが全曲を数える
  assertEquals(adds.sp_normal, 1 - 3);
  assertEquals(adds.sp_hyper, 1 - 3);
  // ANOTHERとBLACKは、ループがレベルを持つ曲だけを数える
  assertEquals(adds.sp_another, 1 - 2);
  assertEquals(adds.dp_black, 0);
});

Deno.test("足す値が16bitに収まらなければ止める", () => {
  const songs = Array.from({ length: 0x8001 }, () => song(false, {}));
  assertThrows(() => totalAdjustments(songs), Error, "sp_normal");
});
