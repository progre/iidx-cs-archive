// 世代の譜面をLZファイルに書き、後から通し番号で読む。
// 譜面の統計と中身のハッシュも、ここで求める。

import type {
  ChartFormat,
  ChartPrint,
  ChartShape,
  ChartStats,
} from "@csa/core";
import { chartPrintOf, statsOfChart } from "../format/mod.ts";
import { chartShapeOf } from "../same.ts";
import { decodeLz } from "../pack/mod.ts";
import {
  buildLzStore,
  lzBinPath,
  type LzIndex,
  lzIndexPath,
  lzIndexText,
  type LzRow,
  lzRowOf,
  type PlainCharts,
} from "./lz_store.ts";
import { readLzBytes, writeLzFiles } from "./lz_store_gateway.ts";

/** 書いた世代のLZファイルの置き場と位置表 */
export interface LzPlace {
  directory: string;
  generation: string;
  index: LzIndex;
}

/** 世代の譜面を`<discsDirectory>/<世代>/chart_lz.bin`と`chart_lz.json`へ書く */
export function writeLzStore(
  discsDirectory: string,
  generation: string,
  charts: PlainCharts,
): LzPlace {
  const { bin, index } = buildLzStore(charts);
  writeLzFiles(
    lzBinPath(discsDirectory, generation),
    lzIndexPath(discsDirectory, generation),
    bin,
    lzIndexText(index),
  );
  return { directory: discsDirectory, generation, index };
}

/** LZ済みの譜面を1件読む。譜面は`sourceFileIndex`で指す */
export function readLzChart(
  { directory, generation, index }: LzPlace,
  sourceFileIndex: number,
): Uint8Array {
  const row = lzRowOf(index, generation, sourceFileIndex);
  return readLzBytes(lzBinPath(directory, generation), generation, row);
}

/** 譜面ごとに、LZの長さと展開した後の長さを、渡した通し番号の順に返す。譜面は読まない */
export function lzChartSizes(
  { generation, index }: LzPlace,
  sourceFileIndices: readonly number[],
): Omit<LzRow, "offset">[] {
  return sourceFileIndices.map((sourceFileIndex) => {
    const { plainSize, size } = lzRowOf(index, generation, sourceFileIndex);
    return { plainSize, size, sourceFileIndex };
  });
}

/**
 * 譜面の統計を通し番号で引く関数を作る。同じ譜面の統計は1回だけ求める。
 * 関数は平文の譜面を持つので、使い終えたら捨てる
 */
export function chartStatsReader(
  generation: string,
  charts: PlainCharts,
  format: ChartFormat,
): (index: number) => ChartStats {
  const cache = new Map<number, ChartStats>();
  return (index) => {
    const cached = cache.get(index);
    if (cached !== undefined) {
      return cached;
    }
    const chart = charts.get(index);
    if (chart === undefined) {
      throw new Error(`${generation}の平文の譜面${index}が無い`);
    }
    const stats = statsOfChart(chart, format);
    cache.set(index, stats);
    return stats;
  };
}

/**
 * 譜面のファイルの通し番号から、LZファイルを展開して、その譜面の中身のハッシュを求める。
 * 曲リストは、これで世代をまたいで同じ譜面かどうかを見分ける
 */
export const chartPrintOfIndex = (
  place: LzPlace,
  index: number,
  format: ChartFormat,
): ChartPrint => chartPrintOf(decodeLz(readLzChart(place, index)), format);

/** 譜面のファイルの通し番号から、版どうしで比べるための譜面の形を求める */
export const chartShapeOfIndex = (
  place: LzPlace,
  index: number,
  format: ChartFormat,
): ChartShape => chartShapeOf(decodeLz(readLzChart(place, index)), format);
