// 世代の譜面を、LZ済みのバイト列として1本のファイルに並べる形式。
// 暗号化はPBの鍵が要るので、周回の後に行う。ここは並べ方と、位置の表だけを持つ。

import { encodeLz } from "../pack/mod.ts";

/** 譜面のファイルの通し番号 → 平文。通し番号は、曲が参照するファイルの一覧の添字 */
export type PlainCharts = ReadonlyMap<number, Uint8Array>;

export interface LzRow {
  offset: number;
  plainSize: number;
  size: number;
  sourceFileIndex: number;
}

export interface LzIndex {
  charts: LzRow[];
}

export interface LzStore {
  bin: Uint8Array;
  index: LzIndex;
}

/** 譜面をファイルの通し番号の昇順にLZ圧縮して並べる */
export function buildLzStore(charts: PlainCharts): LzStore {
  const lzCharts = [...charts]
    .sort(([a], [b]) => a - b)
    .map(([sourceFileIndex, plain]) => ({
      lz: encodeLz(plain),
      plainSize: plain.length,
      sourceFileIndex,
    }));
  const size = lzCharts.reduce((sum, { lz }) => sum + lz.length, 0);
  const bin = new Uint8Array(size);
  let offset = 0;
  const rows = lzCharts.map(({ lz, plainSize, sourceFileIndex }) => {
    bin.set(lz, offset);
    const row = { offset, plainSize, size: lz.length, sourceFileIndex };
    offset += lz.length;
    return row;
  });
  return { bin, index: { charts: rows } };
}

/** 世代のLZファイルのパス。`discsDirectory`は、周回の成果物を世代ごとに置く場所 */
export const lzBinPath = (discsDirectory: string, generation: string): string =>
  `${discsDirectory}/${generation}/chart_lz.bin`;

/** 位置表のパス */
export const lzIndexPath = (
  discsDirectory: string,
  generation: string,
): string => `${discsDirectory}/${generation}/chart_lz.json`;

export const lzIndexText = (index: LzIndex): string =>
  JSON.stringify(index, null, 2) + "\n";

/** 通し番号の行を探す。無ければ例外にする */
export function lzRowOf(
  index: LzIndex,
  generation: string,
  sourceFileIndex: number,
): LzRow {
  const row = index.charts.find((each) =>
    each.sourceFileIndex === sourceFileIndex
  );
  if (row === undefined) {
    throw new Error(`${generation}の譜面${sourceFileIndex}がLZファイルに無い`);
  }
  return row;
}
