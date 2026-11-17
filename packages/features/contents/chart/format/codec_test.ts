import { assertEquals, assertThrows } from "@std/assert";
import { decodeChart } from "./decode.ts";
import { encodeChart } from "./encode.ts";
import { type Chart, F1_MULTIPLIER, type RawEvent } from "./model.ts";

const f3Events: RawEvent[] = [
  { tick: 0, c1: 0x04, c2: 150, param: 0 },
  { tick: 70000, c1: 0x27, c2: 0, param: 0x1234 },
];

Deno.test("F3はencodeしてdecodeすると元に戻る", () => {
  const chart: Chart = {
    format: "F3",
    multiplier: 0x412b,
    events: f3Events,
    terminatorTick: 0x7fff,
  };
  const bytes = encodeChart(chart);
  assertEquals(bytes.length, 8 + 8 * 2 + 4);
  assertEquals(decodeChart(bytes, "F3"), chart);
});

Deno.test("F2はヘッダーを持ち、paramを書けない", () => {
  const events: RawEvent[] = [{ tick: 5, c1: 0x32, c2: 200, param: 0 }];
  const chart: Chart = {
    format: "F2",
    multiplier: 0x4152,
    events,
    terminatorTick: 0x7fff,
  };
  const bytes = encodeChart(chart);
  assertEquals(bytes.length, 8 + 4 + 4);
  assertEquals(decodeChart(bytes, "F2"), chart);
  assertThrows(() =>
    encodeChart({ ...chart, events: [{ ...events[0], param: 1 }] })
  );
});

Deno.test("F1はヘッダーが無く、multiplierを定数で補う", () => {
  const events: RawEvent[] = [{ tick: 9, c1: 0x00, c2: 1, param: 0 }];
  const bytes = encodeChart({
    format: "F1",
    multiplier: F1_MULTIPLIER,
    events,
    terminatorTick: 0x7fff,
  });
  assertEquals(bytes.length, 4 + 4);
  assertEquals(decodeChart(bytes, "F1").multiplier, F1_MULTIPLIER);
});

Deno.test("chartOffsetが4ならmultiplierを定数にする", () => {
  const bytes = Uint8Array.of(4, 0, 0, 0, 0xff, 0x7f, 0, 0);
  assertEquals(decodeChart(bytes, "F3").multiplier, F1_MULTIPLIER);
});

Deno.test("終端が無い・途中で切れた譜面は例外にする", () => {
  const bytes = encodeChart({
    format: "F3",
    multiplier: 1,
    events: f3Events,
    terminatorTick: 0x7fff,
  });
  assertThrows(() => decodeChart(bytes.subarray(0, bytes.length - 4), "F3"));
  assertThrows(() => decodeChart(bytes.subarray(0, 12), "F3"));
  assertThrows(() => decodeChart(bytes.subarray(0, 4), "F3"));
});
