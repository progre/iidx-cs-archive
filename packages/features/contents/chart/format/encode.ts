// ヘッダーとイベント列を平文譜面のバイト列へ書く。

import { type Chart, CHART_OFFSET, eventSizeOf, hasHeader } from "./model.ts";

function writeEvent(
  view: DataView,
  at: number,
  chart: Chart,
  index: number,
): void {
  const event = chart.events[index];
  if (chart.format === "F3") {
    view.setUint32(at, event.tick, true);
    view.setUint8(at + 4, event.c1);
    view.setUint8(at + 5, event.c2);
    view.setUint16(at + 6, event.param, true);
    return;
  }
  if (event.tick > 0xffff) {
    throw new Error(`tick ${event.tick} does not fit in u16 (F1/F2)`);
  }
  if (event.param !== 0) {
    throw new Error(
      `F1/F2 has no param field, but event carries param=0x${
        event.param.toString(16).toUpperCase().padStart(4, "0")
      }`,
    );
  }
  view.setUint16(at, event.tick, true);
  view.setUint8(at + 2, event.c1);
  view.setUint8(at + 3, event.c2);
}

/** 終端は全形式とも4バイト(`FF 7F 00 00`)で、c1・c2・paramは続かない */
export function encodeChart(chart: Chart): Uint8Array {
  const headerSize = hasHeader(chart.format) ? CHART_OFFSET : 0;
  const eventSize = eventSizeOf(chart.format);
  const out = new Uint8Array(headerSize + chart.events.length * eventSize + 4);
  const view = new DataView(out.buffer);
  if (headerSize > 0) {
    view.setUint32(0, CHART_OFFSET, true);
    view.setUint32(4, chart.multiplier, true);
  }
  chart.events.forEach((_, index) =>
    writeEvent(view, headerSize + index * eventSize, chart, index)
  );
  view.setUint32(out.length - 4, chart.terminatorTick, true);
  return out;
}
