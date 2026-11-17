// 形式はファイルの内容から判別できない(F2とF3はヘッダーが同形)ので、世代から決めて渡す。

import type { ChartFormat } from "@csa/core";

export const TERMINATOR_TICK = 0x7fff;

/** F1のファイルにはmultiplierの欄が無く、ゲームの読み込み処理がこの定数を使う */
export const F1_MULTIPLIER = 0x414c;

/** 実データでは全形式・全譜面で、ヘッダー直後からイベントが始まる */
export const CHART_OFFSET = 8;

/** F1/F2は1バイトのフィールドをc2に入れ、paramを0にする */
export interface RawEvent {
  tick: number;
  c1: number;
  c2: number;
  param: number;
}

export interface Chart {
  format: ChartFormat;
  multiplier: number;
  events: RawEvent[];
  terminatorTick: number;
}

export function eventSizeOf(format: ChartFormat): number {
  return format === "F3" ? 8 : 4;
}

export function hasHeader(format: ChartFormat): boolean {
  return format !== "F1";
}

export function commandOf(event: RawEvent): number {
  return event.c1 & 0x0f;
}
