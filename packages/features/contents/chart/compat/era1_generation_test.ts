import { assertEquals, assertThrows } from "@std/assert";
import { parseEvents } from "../format/mod.ts";
import { encodeLz } from "../pack/mod.ts";
import {
  convertEra1GenerationCharts,
  type Era1ChartTarget,
  type Era1GenerationPorts,
} from "./era1_generation.ts";

/** F1形式の譜面。tick=10・c1=2・c2=5のイベント1つと、終端tick=0x7fff */
const plain = (() => {
  const out = new Uint8Array(8);
  const view = new DataView(out.buffer);
  view.setUint16(0, 10, true);
  out[2] = 0x02;
  out[3] = 5;
  view.setUint16(4, 0x7fff, true);
  return out;
})();

const portsOf = (
  targets: Era1ChartTarget[],
  over: Partial<Era1GenerationPorts<Era1ChartTarget>> = {},
): Era1GenerationPorts<Era1ChartTarget> => ({
  assertSameKeysoundBank: () => {},
  format: "F1",
  generation: "7th",
  keysoundOf: () => 3,
  readLzChart: () => encodeLz(plain),
  soundMapOf: () => ({ "5": 77 }),
  targets,
  ...over,
});

Deno.test("譜面を展開して変換し、同じ譜面は再利用する", () => {
  const checked: [string, number, number][] = [];
  const result = convertEra1GenerationCharts(portsOf(
    [{ sourceFileIndex: 4, title: "a" }, { sourceFileIndex: 4, title: "b" }],
    {
      assertSameKeysoundBank: (key, converted, keysound) =>
        checked.push([key, converted, keysound]),
    },
  ));
  assertEquals([result.converted, result.reused], [1, 1]);
  assertEquals(checked, [["7th/4", 3, 3]]);
  const events = parseEvents(result.charts.get(4)!, "F3")!;
  assertEquals(events[0].param, 77);
});

Deno.test("sound mapが無ければ例外にする", () => {
  assertThrows(
    () =>
      convertEra1GenerationCharts(portsOf(
        [{ sourceFileIndex: 4, title: "a" }],
        { soundMapOf: () => undefined },
      )),
    Error,
    "a キー音3のsound mapが無い",
  );
});

Deno.test("イベント列が途中で切れた譜面は例外にする", () => {
  const broken = new Uint8Array(14);
  broken[8] = 1;
  assertThrows(
    () =>
      convertEra1GenerationCharts(portsOf(
        [{ sourceFileIndex: 4, title: "a" }],
        { format: "F3", readLzChart: () => encodeLz(broken) },
      )),
    Error,
    "7thの譜面4のイベント列が途中で切れている",
  );
});
