import { assertEquals } from "@std/assert";
import { convertEra1ChartFile } from "./era1_file.ts";
import { parseEvents } from "../format/mod.ts";

/** F1形式の譜面。4バイト/イベント(tick u16, c1, c2)と、終端tick=0x7fff */
function f1ChartOf(events: { tick: number; c1: number; c2: number }[]) {
  const out = new Uint8Array(events.length * 4 + 4);
  const view = new DataView(out.buffer);
  events.forEach((event, i) => {
    view.setUint16(i * 4, event.tick, true);
    out[i * 4 + 2] = event.c1;
    out[i * 4 + 3] = event.c2;
  });
  view.setUint16(events.length * 4, 0x7fff, true);
  return out;
}

Deno.test("F1の譜面をF3へ変換し、sound mapで音を振り直す", () => {
  const plain = f1ChartOf([{ tick: 10, c1: 0x02, c2: 5 }]);
  const converted = convertEra1ChartFile(plain, "F1", { "5": 77 });
  const events = parseEvents(converted!, "F3")!;
  assertEquals(events.length, 1);
  assertEquals(events[0].param, 77);
});

Deno.test("sound mapに無い音は目印を経て取り除かれ、鳴らさない形になる", () => {
  const plain = f1ChartOf([{ tick: 10, c1: 0x07, c2: 9 }]);
  const converted = convertEra1ChartFile(plain, "F1", {});
  assertEquals(parseEvents(converted!, "F3")!.length, 0);
});

Deno.test("イベント列が途中で切れた譜面はnullを返す", () => {
  const plain = new Uint8Array(14);
  plain[8] = 1;
  assertEquals(convertEra1ChartFile(plain, "F3", {}), null);
});
