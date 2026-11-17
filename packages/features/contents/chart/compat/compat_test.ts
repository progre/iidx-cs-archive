import { assertEquals } from "@std/assert";
import { type Chart, F1_MULTIPLIER, type RawEvent } from "../format/mod.ts";
import { convertEra1Chart, era1ToPb, PB_MULTIPLIER } from "./era1_file.ts";
import { remapSoundIds } from "./era1_file.ts";
import { insertTimesig, meterOf } from "./timesig.ts";
import { rescaleMultiplier, toF3 } from "./widen.ts";

const f1Chart = (events: RawEvent[]): Chart => ({
  format: "F1",
  multiplier: F1_MULTIPLIER,
  events,
  terminatorTick: 0x7fff,
});

Deno.test("toF3はsound_idを運ぶコマンドだけc2からparamへ移す", () => {
  const out = toF3(f1Chart([
    { tick: 10, c1: 0x32, c2: 200, param: 0 },
    { tick: 0, c1: 0x04, c2: 150, param: 0 },
    { tick: 1, c1: 0x00, c2: 250, param: 0 },
    { tick: 2, c1: 0x18, c2: 0xfa, param: 0 },
  ]));
  assertEquals(out.format, "F3");
  assertEquals(out.events[0], { tick: 10, c1: 0x32, c2: 0, param: 200 });
  assertEquals(out.events.slice(1).map((e) => [e.c2, e.param]), [
    [150, 0],
    [250, 0],
    [0xfa, 0],
  ]);
});

Deno.test("era1ToPbは形式を広げ、実時間が保たれるようtickを再スケールする", () => {
  const out = era1ToPb(
    f1Chart([{ tick: 1000, c1: 0x0c, c2: 0, param: 0 }]),
  );
  assertEquals(out.format, "F3");
  assertEquals(out.multiplier, PB_MULTIPLIER);
  assertEquals(
    out.events[0].tick,
    Math.round(1000 * F1_MULTIPLIER / PB_MULTIPLIER),
  );
});

Deno.test("rescaleMultiplierは同じmultiplierなら何もしない", () => {
  const chart = f1Chart([{ tick: 3, c1: 0, c2: 0, param: 0 }]);
  assertEquals(rescaleMultiplier(chart, F1_MULTIPLIER), chart);
});

Deno.test("meterOfは公式の拍子と85/86tickの揺れを読む", () => {
  assertEquals(meterOf(1), { numerator: 1, denominator: 4 });
  assertEquals(meterOf(2), { numerator: 2, denominator: 4 });
  assertEquals(meterOf(4.5), { numerator: 9, denominator: 8 });
  assertEquals(meterOf(5.25), { numerator: 21, denominator: 16 });
  assertEquals(meterOf(4.004), { numerator: 4, denominator: 4 });
  assertEquals(meterOf(4.051), { numerator: 4, denominator: 4 });
});

/** 7th Y31と同じ条件(multiplier 0x4152、BPM 169、標準85tick)の合成譜面 */
const y31Like = (bars: number[]): Chart => ({
  format: "F3",
  multiplier: 0x4152,
  events: [
    { tick: 0, c1: 0x04, c2: 169, param: 0 },
    ...bars.map((tick) => ({ tick, c1: 0x0c, c2: 0, param: 0 })),
  ].sort((a, b) => a.tick - b.tick),
  terminatorTick: 0x7fff,
});

const timesigs = (chart: Chart) =>
  chart.events
    .filter((e) => (e.c1 & 0x0f) === 5)
    .map((e) => [e.tick, e.c2, e.param]);

Deno.test("insertTimesigは拍子が変わった小節にだけ置く", () => {
  const chart = insertTimesig(y31Like([0, 85, 170, 319, 404, 489]));
  assertEquals(timesigs(chart), [[0, 4, 4], [170, 7, 4], [319, 4, 4]]);
});

Deno.test("insertTimesigは同じtickの最後のbpmの直後に置く", () => {
  const chart = insertTimesig(y31Like([0, 85, 170]));
  assertEquals(
    chart.events.filter((e) => e.tick === 0).map((e) => e.c1 & 0x0f),
    [4, 5, 0x0c],
  );
});

Deno.test("insertTimesigは拍子イベントがあれば何もしない", () => {
  const chart = y31Like([0, 85, 170, 319]);
  chart.events.push({ tick: 0, c1: 5, c2: 4, param: 4 });
  assertEquals(insertTimesig(chart), chart);
});

Deno.test("remapSoundIdsは対応表にある値だけ書き換える", () => {
  const chart = toF3(f1Chart([
    { tick: 0, c1: 0x02, c2: 10, param: 0 },
    { tick: 1, c1: 0x07, c2: 2, param: 0 },
    { tick: 2, c1: 0x04, c2: 10, param: 0 },
  ]));
  const out = remapSoundIds(chart, { "10": 300 });
  assertEquals(out.events.map((e) => e.param), [300, 2, 0]);
});

Deno.test("convertEra1ChartはF1の平文からPB相当のF3を作る", () => {
  const plain = Uint8Array.of(
    ...[0x00, 0x00, 0x04, 150],
    ...[0x00, 0x00, 0x0c, 0],
    ...[0xff, 0x7f, 0, 0],
  );
  const out = convertEra1Chart(plain, "F1", null);
  assertEquals(out.length, 8 + 8 * 2 + 4);
  assertEquals(new DataView(out.buffer).getUint32(4, true), PB_MULTIPLIER);
});
