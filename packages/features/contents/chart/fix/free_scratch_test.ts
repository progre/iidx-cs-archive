// フリースクラッチを取り除く処理(withoutFreeScratch)を、
// 譜面を自分で組み立てて見る。原盤は読まない。
import { assertEquals, assertStrictEquals } from "@std/assert";
import { decodeChart, encodeChart, type RawEvent } from "../format/mod.ts";
import { withoutFreeScratch } from "./bgm_start.ts";

const chartOf = (events: RawEvent[]): Uint8Array =>
  encodeChart({
    format: "F3",
    multiplier: 0x412b,
    events,
    terminatorTick: 0x7fff,
  });

const note = (tick: number, c1: number): RawEvent => ({
  tick,
  c1,
  c2: 0,
  param: 0,
});

Deno.test("1P と 2P のスロット 8 のノーツだけを取り除く", () => {
  const chart = chartOf([
    note(10, 0x00),
    note(20, 0x80),
    note(30, 0x71),
    note(40, 0x81),
    note(50, 0x87),
  ]);
  const events = decodeChart(withoutFreeScratch(chart, "F3"), "F3").events;
  assertEquals(events.map((e) => e.tick), [10, 30, 50]);
});

Deno.test("フリースクラッチが無い譜面は、同じバイト列を返す", () => {
  const chart = chartOf([note(10, 0x00), note(20, 0x87)]);
  assertStrictEquals(withoutFreeScratch(chart, "F3"), chart);
});
