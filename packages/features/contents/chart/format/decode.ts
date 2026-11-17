// 平文譜面をヘッダーとイベント列へ読む。

import type { ChartFormat } from "@csa/core";
import {
  type Chart,
  eventSizeOf,
  F1_MULTIPLIER,
  hasHeader,
  type RawEvent,
  TERMINATOR_TICK,
} from "./model.ts";

function truncated(what: string): Error {
  return new Error(`chart truncated: ${what}`);
}

/** ヘッダーを読み、イベント列の先頭位置とmultiplierを返す */
function readHeader(
  view: DataView,
  format: ChartFormat,
): { start: number; multiplier: number } {
  if (!hasHeader(format)) {
    return { start: 0, multiplier: F1_MULTIPLIER };
  }
  if (view.byteLength < 8) {
    throw truncated("header");
  }
  const start = view.getUint32(0, true);
  if (start > view.byteLength) {
    throw truncated("chartOffset beyond end");
  }
  // chartOffsetが4の譜面にはmultiplierの欄が無い。その場合はF1_MULTIPLIERを使う
  const multiplier = start === 4 ? F1_MULTIPLIER : view.getUint32(4, true);
  return { start, multiplier };
}

function readEvent(
  view: DataView,
  at: number,
  tick: number,
  format: ChartFormat,
): RawEvent {
  if (format === "F3") {
    return {
      tick,
      c1: view.getUint8(at + 4),
      c2: view.getUint8(at + 5),
      param: view.getUint16(at + 6, true),
    };
  }
  return {
    tick,
    c1: view.getUint8(at + 2),
    c2: view.getUint8(at + 3),
    param: 0,
  };
}

/** 終端まで読む。終端が無い、またはイベントが途中で切れていれば例外 */
export function decodeChart(data: Uint8Array, format: ChartFormat): Chart {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const { start, multiplier } = readHeader(view, format);
  const tickSize = format === "F3" ? 4 : 2;
  const eventSize = eventSizeOf(format);
  const events: RawEvent[] = [];
  for (let at = start;; at += eventSize) {
    if (at + tickSize > data.length) {
      throw truncated("event tick");
    }
    const tick = format === "F3"
      ? view.getUint32(at, true)
      : view.getUint16(at, true);
    if (tick === TERMINATOR_TICK) {
      return { format, multiplier, events, terminatorTick: tick };
    }
    if (at + eventSize > data.length) {
      throw truncated("event body");
    }
    events.push(readEvent(view, at, tick, format));
  }
}
