// 版どうしで比べるための譜面の形を、譜面のバイト列から求める。

import type { ChartFormat, ChartShape } from "@csa/core";
import { type ChartEvent, parseEvents } from "./format/mod.ts";

const isNote = (e: ChartEvent) => e.cmd < 2 && e.c2 === 0;

/** イベントが途中で切れた譜面は例外にする */
export function chartShapeOf(buf: Uint8Array, format: ChartFormat): ChartShape {
  const events = parseEvents(buf, format);
  if (events === null) {
    throw new Error("譜面のイベントが途中で切れている");
  }
  const byKey = Map.groupBy(events.filter(isNote), (e) => `${e.cmd}.${e.p4}`);
  return {
    keys: Object.fromEntries(
      [...byKey].map((
        [key, notes],
      ) => [key, notes.map((n) => n.tick).sort((a, b) => a - b)]),
    ),
  };
}
