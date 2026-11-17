// 素材のDATA1にある`.if`1本を、manifestのファイルの範囲にする。

import { SEC, type SourceSlice } from "@csa/core";

/** 素材ELFにあるDATA1のTOC */
export interface Data1Toc {
  /** TOCが示すアーカイブの名前 */
  archive: string;
  /** TOCの件数 */
  count: number;
  /** ファイル番号のTOCの行。位置が合わなければ例外にする */
  rowOf(fileIndex: number): { count: number; sector: number };
}

/** `label`は、エラーの文章に出す曲の名前である */
export function data1Slice(
  label: string,
  fileIndex: number,
  toc: Data1Toc,
): SourceSlice {
  if (fileIndex >= toc.count) {
    throw new Error(`${label} オーバーレイ ${fileIndex} が不正`);
  }
  const row = toc.rowOf(fileIndex);
  if (row.count === 0) {
    throw new Error(`素材DATA1 TOC[${fileIndex}] のセクタ数が0`);
  }
  return {
    sourceArchive: toc.archive,
    sourceFileIndex: fileIndex,
    sourceOffset: row.sector * SEC,
    sourceSize: row.count * SEC,
  };
}
