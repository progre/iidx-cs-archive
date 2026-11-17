// F3の平文譜面を、ヘッダとイベントの並びとして読み書きする。
// ヘッダの長さは先頭のu32、イベントは8バイト、終端は4バイト。

const EVENT_SIZE = 8;
const PARAM_OFFSET = 6;
const TERMINATOR_TICK = 0x7fff;
const TERMINATOR_SIZE = 4;

export interface F3Event {
  /** イベント8バイトの写し。書き換えても元の譜面は変わらない */
  bytes: Uint8Array;
  cmd: number;
  param: number;
  tick: number;
}

export interface F3Chart {
  events: F3Event[];
  header: Uint8Array;
}

export function readF3(chart: Uint8Array): F3Chart {
  const view = new DataView(chart.buffer, chart.byteOffset, chart.byteLength);
  const eventStart = view.getUint32(0, true);
  const events: F3Event[] = [];
  for (
    let at = eventStart;
    at + TERMINATOR_SIZE <= chart.length;
    at += EVENT_SIZE
  ) {
    const tick = view.getUint32(at, true);
    if (tick === TERMINATOR_TICK) {
      return { events, header: chart.subarray(0, eventStart) };
    }
    if (at + EVENT_SIZE > chart.length) {
      break;
    }
    events.push({
      bytes: chart.slice(at, at + EVENT_SIZE),
      cmd: chart[at + 4] & 0x0f,
      param: view.getUint16(at + PARAM_OFFSET, true),
      tick,
    });
  }
  throw new Error("F3譜面の終端が無い");
}

/** `param`だけを差し替えたイベント */
export function withParam(event: F3Event, param: number): F3Event {
  const bytes = event.bytes.slice();
  new DataView(bytes.buffer).setUint16(PARAM_OFFSET, param, true);
  return { ...event, bytes, param };
}

export function writeF3({ events, header }: F3Chart): Uint8Array {
  const out = new Uint8Array(
    header.length + events.length * EVENT_SIZE + TERMINATOR_SIZE,
  );
  out.set(header);
  events.forEach((event, i) =>
    out.set(event.bytes, header.length + i * EVENT_SIZE)
  );
  new DataView(out.buffer).setUint32(
    out.length - TERMINATOR_SIZE,
    TERMINATOR_TICK,
    true,
  );
  return out;
}
