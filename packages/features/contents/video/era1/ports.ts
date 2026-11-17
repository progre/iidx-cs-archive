// era1ムービーの変換と、形式の表を作る処理が使う、他の feature の関数。実装は app が渡す。

import type { PssFactsInput, PssHead } from "../head/mod.ts";

/** 原盤の中の、ムービー1本の範囲 */
export interface Era1VideoRange {
  archive: string;
  generation: string;
  /** 世代の中でファイルを一意に指す名前 */
  key: string;
  offset: number;
  size: number;
}

/** 変換したムービーの検査の結果 */
export interface Era1ConvertResult {
  pictures: number;
  problems: string[];
  size: number;
}

/** `J`は変換の仕事1つ。`video`に原盤の中の範囲を持つ */
export interface Era1ConvertPorts<J extends { video: Era1VideoRange }> {
  /** 変換結果の`.json`の中身が、ビルドを続けてよい状態でなければ例外にする */
  checkReport(job: J, reportText: string): void;
  /** ffmpegの出力の符号化の引数 */
  encodeArgs: readonly string[];
  /** ffmpegの映像フィルター */
  filterOf(job: J): string;
  findProblems(facts: PssFactsInput): string[];
  labelOf(job: J): string;
  /** 変換したムービーの隣に書く`.json`の中身 */
  metaTextOf(job: J, result: Era1ConvertResult): string;
  outputPathOf(discsDirectory: string, job: J): string;
  /** 原盤からムービーを読む */
  read(job: J): Promise<Uint8Array>;
  reportLineOf(job: J, result: Era1ConvertResult): string;
}

export interface Era1FormatPorts {
  /** 形式の表のキー */
  formatKeyOf(generation: string, key: string): string;
  /** 形式の表の値 */
  formatOf(head: PssHead): string;
  /** 原盤から、ムービーの範囲の先頭を`size`バイト読む */
  read(video: Era1VideoRange, size: number): Promise<Uint8Array>;
}
