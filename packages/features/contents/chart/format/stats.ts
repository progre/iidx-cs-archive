// 平文譜面のイベント列・ノーツ数・BPM。

import type { ChartFormat, ChartStats } from "@csa/core";

export interface ChartEvent {
  tick: number;
  cmd: number;
  p4: number;
  c2: number;
  param: number;
}

/** 終端 tick=0x7FFF まで読む。イベントが途中で切れていれば null。 */
export function parseEvents(
  buf: Uint8Array,
  fmt: ChartFormat,
): ChartEvent[] | null {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const evLen = fmt === "F3" ? 8 : 4;
  let p = fmt === "F1" ? 0 : 8;
  const out = new Array<ChartEvent>();
  while (p + 4 <= buf.length) {
    if (fmt === "F3") {
      const tick = dv.getUint32(p, true);
      if (tick === 0x7fff) break;
      if (p + 8 > buf.length) return null;
      const c1 = dv.getUint8(p + 4);
      out.push({
        tick,
        cmd: c1 & 0x0f,
        p4: c1 >> 4,
        c2: dv.getUint8(p + 5),
        param: dv.getUint16(p + 6, true),
      });
    } else {
      const tick = dv.getUint16(p, true);
      if (tick === 0x7fff) break;
      const c1 = dv.getUint8(p + 2);
      out.push({
        tick,
        cmd: c1 & 0x0f,
        p4: c1 >> 4,
        c2: dv.getUint8(p + 3),
        param: 0,
      });
    }
    p += evLen;
  }
  return out;
}

export function chartStats(evs: ChartEvent[]): ChartStats {
  let p1 = 0, p2 = 0, p1All = 0, p2All = 0;
  let bpmFirst = -1, bpmMin = 1e9, bpmMax = -1, bgmTick = -1;
  let firstNoteTick = -1;
  const lastTick = evs.length === 0
    ? -1
    : (evs.at(evs.length - 1) as ChartEvent).tick;
  for (const e of evs) {
    if (e.cmd < 2 && e.c2 === 0 && firstNoteTick < 0) firstNoteTick = e.tick;
    if (e.cmd === 0) {
      p1All++;
      if (e.c2 === 0) p1++;
    } else if (e.cmd === 1) {
      p2All++;
      if (e.c2 === 0) p2++;
    } else if (e.cmd === 4) {
      // cmd4 の p4 は {0,1} しか取らず、BPM の bit8 として働く(255 超の BPM がある)。
      const v = e.c2 | (e.p4 << 8);
      if (bpmFirst < 0) bpmFirst = v;
      if (v < bpmMin) bpmMin = v;
      if (v > bpmMax) bpmMax = v;
    } else if (e.cmd === 7 && (e.param === 1 || e.param === 2) && bgmTick < 0) {
      bgmTick = e.tick;
    }
  }
  if (bpmMax < 0) bpmMin = -1;
  return {
    p1,
    p2,
    total: p1 + p2,
    p1All,
    p2All,
    totalAll: p1All + p2All,
    bpmFirst,
    bpmMin,
    bpmMax,
    bgmTick,
    firstNoteTick,
    lastTick,
  };
}

/** 平文譜面を読み、統計量にする。終端が壊れていれば止める */
export function statsOfChart(buf: Uint8Array, fmt: ChartFormat): ChartStats {
  const events = parseEvents(buf, fmt);
  if (events === null) throw new Error("譜面のイベント列が途中で切れている");
  return chartStats(events);
}
