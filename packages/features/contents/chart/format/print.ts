// 譜面の中身のハッシュ。曲リストは、これで世代をまたいで同じ譜面かどうかを見分ける。
// 3rd〜6th の譜面を PB の形式に直すと、tick の値が変わる。そのため、tick の値は使わない。
// ハッシュの元は2つある。1つはノーツの鍵盤の並びで、時刻の順に並べる。
// ノーツは、ノーツ数を数えるときと同じものだけを使う。もう1つは、判定の値(cmd 8)である。
// ノーツの並びだけのハッシュも求め、判定だけが違う譜面を見分けられるようにする。
// 同じ tick のノーツは、ファイルの中の並びに左右されないよう、並べ替えてからまとめる。

import type { ChartFormat, ChartPrint } from "@csa/core";
import { type ChartEvent, parseEvents } from "./stats.ts";

const TIMING = 8;

const isNote = (e: ChartEvent) => e.cmd < 2 && e.c2 === 0;

/** 同じ tick のイベントを1つの印にまとめ、tick の順に並べる */
function stepsOf(events: readonly ChartEvent[]): string[] {
  const byTick = Map.groupBy(events, (e) => e.tick);
  return [...byTick].sort(([a], [b]) => a - b).map(([, group]) =>
    group.map((e) => `${e.cmd}.${e.p4}.${e.cmd === TIMING ? e.c2 : 0}`)
      .sort().join("+")
  );
}

/** FNV-1a(32bit)。曲リストで見分けるだけなので、暗号学的な強さは要らない */
function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

const printOf = (events: readonly ChartEvent[]) =>
  fnv1a(stepsOf(events).join(","));

/** イベントが途中で切れた譜面は例外にする */
export function chartPrintOf(
  buf: Uint8Array,
  format: ChartFormat,
): ChartPrint {
  const events = parseEvents(buf, format);
  if (events === null) {
    throw new Error("譜面のイベントが途中で切れている");
  }
  const notes = events.filter(isNote);
  return {
    all: printOf(events.filter((e) => isNote(e) || e.cmd === TIMING)),
    notes: printOf(notes),
  };
}
