// 小節線の間隔から拍子(cmd5)を復元する。
// era1には拍子イベントが無く、拍子は小節の長さだけで表されている。PBのエンジンは
// 拍子イベントを見るので、書かないと変則小節を4拍と誤解して音がズレる。

import { type Chart, commandOf, type RawEvent } from "../format/mod.ts";

const CMD_BPM = 4;
const CMD_TIMESIG = 5;
const CMD_MEASURE = 0x0c;

/**
 * 小節長を拍数に直したときの丸め許容(拍)。85tickと86tickの交互を4拍として吸収し、
 * 4.5拍や5.25拍は取りこぼさない幅
 */
const BEAT_EPS = 0.15;

export interface Meter {
  numerator: number;
  denominator: number;
}

/** 拍数から拍子を決める。分母は{4,8,16}のうち、分子が整数になる最小のもの */
export function meterOf(beats: number): Meter | null {
  for (const denominator of [4, 8, 16]) {
    const numerator = Math.round(beats * denominator / 4);
    if (numerator < 1 || numerator > 255) {
      continue;
    }
    if (Math.abs(numerator * 4 / denominator - beats) < BEAT_EPS) {
      return { numerator, denominator };
    }
  }
  return null;
}

const sameMeter = (a: Meter | null, b: Meter) =>
  a != null && a.numerator === b.numerator && a.denominator === b.denominator;

/** 小節線(cmd C)のtick。重複を除き昇順 */
function barTicks(events: readonly RawEvent[]): number[] {
  const ticks = events
    .filter((e) => commandOf(e) === CMD_MEASURE && e.c1 >> 4 === 0)
    .map((e) => e.tick);
  return [...new Set(ticks)].sort((a, b) => a - b);
}

/** BPMの変化点(tick, bpm)。同じtickの順序は入力のまま */
function bpmChanges(events: readonly RawEvent[]): [number, number][] {
  return events
    .filter((e) => commandOf(e) === CMD_BPM && e.c1 >> 4 === 0 && e.c2 > 0)
    .map((e): [number, number] => [e.tick, e.c2])
    .sort((a, b) => a[0] - b[0]);
}

/** 拍子が変わった小節にだけ(tick, 拍子)を立てる。曲頭の宣言もこれで出る */
function meterChanges(chart: Chart, bars: number[], bpms: [number, number][]) {
  const bpmAt = (tick: number) => {
    let bpm = bpms[0][1];
    for (const [at, value] of bpms) {
      if (at > tick) {
        break;
      }
      bpm = value;
    }
    return bpm;
  };
  const changes: { tick: number; meter: Meter }[] = [];
  let previous: Meter | null = null;
  bars.slice(0, -1).forEach((tick, i) => {
    const perBeat = 6e7 / (bpmAt(tick) * chart.multiplier);
    const meter = meterOf((bars[i + 1] - tick) / perBeat);
    if (meter != null && !sameMeter(previous, meter)) {
      changes.push({ tick, meter });
      previous = meter;
    }
  });
  return changes;
}

/** 同じtickのイベント群 */
function groupByTick(events: readonly RawEvent[]): RawEvent[][] {
  const groups: RawEvent[][] = [];
  events.forEach((event) => {
    const last = groups.at(-1);
    if (last != null && last[0].tick === event.tick) {
      last.push(event);
    } else {
      groups.push([event]);
    }
  });
  return groups;
}

/** 公式は同一tick内で「最後のbpmの直後、bpmが無ければ先頭」に拍子を置く */
function withTimesig(group: RawEvent[], meter: Meter): RawEvent[] {
  const lastBpm = group.findLastIndex((e) => commandOf(e) === CMD_BPM);
  const timesig: RawEvent = {
    tick: group[0].tick,
    c1: CMD_TIMESIG,
    c2: meter.numerator,
    param: meter.denominator,
  };
  return [...group.slice(0, lastBpm + 1), timesig, ...group.slice(lastBpm + 1)];
}

/** 既に拍子イベントを持つ譜面(era2以降)や、復元できない譜面はそのまま返す */
export function insertTimesig(chart: Chart): Chart {
  if (chart.events.some((e) => commandOf(e) === CMD_TIMESIG)) {
    return chart;
  }
  const bars = barTicks(chart.events);
  const bpms = bpmChanges(chart.events);
  if (bars.length < 2 || bpms.length === 0) {
    return chart;
  }
  const changes = meterChanges(chart, bars, bpms);
  if (changes.length === 0) {
    return chart;
  }
  const events = groupByTick(chart.events).flatMap((group) => {
    const change = changes.find((c) => c.tick === group[0].tick);
    return change == null ? group : withTimesig(group, change.meter);
  });
  return { ...chart, events };
}
