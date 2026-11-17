// 曲DBに書く題名を作る。その題名で、曲が頭文字フォルダーに入るかも決める。
// 選曲リストの曲名順はこの欄をstrcmpで比較して決まるので、
// 原盤と同じく大文字へそろえる。

import type { SongDbRecord } from "../record/mod.ts";

const LARGE_A = 0x41;
const LARGE_Z = 0x5a;

/**
 * USの題名にだけ、先頭に`<表示順> <内部番号>_`が付く。
 * そのままでは曲名順の並びが内部番号順になる
 */
const INDEX_PREFIX = /^\d+ \d+_/;
/** USの題名は、末尾に空白が付くことがある。空白は英字より前に並ぶので落とす */
const TRAILING_SPACES = / +$/;
/** PBの題名欄に書けるのは、ASCIIだけである */
const NOT_PRINTABLE_ASCII = /[^\x20-\x7e]/g;

/**
 * 頭文字フォルダー(ABCD〜UVWXYZ)へ入る題名か。エンジンが参照するのは、先頭1バイトだけである。
 * 入らない曲は、OTHERSの印を立てたときだけ一覧に出る
 */
export function hasNameFolderInitial(record: SongDbRecord): boolean {
  const head = record.title.bytes.at(0) ?? 0;
  return head >= LARGE_A && head <= LARGE_Z;
}

/** 素材の題名を、PBの題名欄へ書く文字列にする。枠に収まるかは、書くときに確かめる */
export function pbTitleOf(text: string, hasIndexPrefix: boolean): string {
  const bare = hasIndexPrefix
    ? text.replace(INDEX_PREFIX, "").replace(TRAILING_SPACES, "")
    : text;
  return bare.replaceAll(NOT_PRINTABLE_ASCII, "").toUpperCase();
}
