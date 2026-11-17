// 暗号化した譜面を1本のbundleへ連結し、各譜面の位置を索引に残す。

import { decryptCbcCts, encryptCbcCts } from "./blowfish_cts.ts";
import { decodeLz } from "./lz.ts";

/** LZ済みの譜面を暗号化する。長さが8バイト以下なら、`encryptCbcCts`が例外を投げる */
export function encryptLzChart(lz: Uint8Array, key: Uint8Array): Uint8Array {
  return encryptCbcCts(lz, key);
}

/** LZ済みの譜面。`plainSize`は展開後の長さ */
export interface LzChart {
  lz: Uint8Array;
  plainSize: number;
  sourceFileIndex: number;
}

export interface PackedChartRow {
  offset: number;
  plainSize: number;
  size: number;
  sourceFileIndex: number;
}

export interface PackedChartIndex {
  bundleBytes: number;
  charts: PackedChartRow[];
  plainBytes: number;
}

const sameBytes = (a: Uint8Array, b: Uint8Array) =>
  a.length === b.length && a.every((value, i) => value === b[i]);

/**
 * LZ済みの譜面1件を暗号化する。
 * 暗号化した譜面は、すぐ復号して2つを確かめる。
 * - 復号した結果が、暗号化する前のLZのバイト列と一致する。
 * - 展開した長さが、平文の長さと一致する。
 */
export function packLzChart(
  { lz, plainSize, sourceFileIndex }: LzChart,
  key: Uint8Array,
): Uint8Array {
  const packed = encryptLzChart(lz, key);
  if (
    !sameBytes(decryptCbcCts(packed, key), lz) ||
    decodeLz(lz).length !== plainSize
  ) {
    throw new Error(`file ${sourceFileIndex}のPB packを読み戻せない`);
  }
  return packed;
}

/**
 * 譜面を並べた順にbundleへ連結する場合の、位置の索引を作る。
 * 暗号化は長さを変えないので、暗号化する前のLZの長さを`size`に渡せばよい。
 */
export function planPackedChartIndex(
  charts: readonly Omit<PackedChartRow, "offset">[],
): PackedChartIndex {
  let offset = 0;
  const rows = charts.map(({ plainSize, size, sourceFileIndex }) => {
    const row = { offset, plainSize, size, sourceFileIndex };
    offset += size;
    return row;
  });
  return {
    bundleBytes: offset,
    charts: rows,
    plainBytes: charts.reduce((sum, { plainSize }) => sum + plainSize, 0),
  };
}
