// 曲DBエントリのうち、譜面・ムービー・音のファイルを参照するフィールドを読み取る。
// このファイルは、manifest に載せるエントリーの作品番号・ムービー・譜面のフィールドも書き換える。
// 欄は定義の配置で読み書きする(`PbEntryFormat`)。

import type { FieldWidth } from "@csa/core";
import { difficultyOf, type PbEntryFormat } from "./format/mod.ts";

/**
 * 曲DBのムービーの印の欄の下位2bit。
 * bit0は、ムービーを横に引き伸ばす印である。
 * bit1は、ムービーが480x480である印である。
 */
export const VIDEO_FLAG_BITS = 0x03;
export const FLAG_VIDEO_480 = 0x02;

/** ファイルを参照する1つのフィールドと、参照先のファイルの通し番号 */
export interface FileField {
  fieldOffset: number;
  fileIndex: number;
  width: FieldWidth;
}

/** 使っているフィールドだけを、種別ごとに、フィールドの並び順に並べる */
export interface EntryFileFields {
  chart: FileField[];
  sound: FileField[];
  video: FileField[];
}

/** 空のフィールドは、u32なら0か0xFFFFFFFF、u16なら0か0xFFFFである */
function usedFields(
  values: readonly number[],
  offsetOf: (index: number) => number,
  width: FieldWidth,
): FileField[] {
  const empty = width === "u32" ? 0xffffffff : 0xffff;
  return values
    .map((fileIndex, i): FileField => ({
      fieldOffset: offsetOf(i),
      fileIndex,
      width,
    }))
    .filter(({ fileIndex }) => fileIndex !== 0 && fileIndex !== empty);
}

/** PB形式の曲DBエントリの、ファイルを参照するフィールド */
export function readFileFields(
  format: PbEntryFormat,
  entry: Uint8Array,
): EntryFileFields {
  const record = format.recordOf(entry);
  return {
    chart: usedFields(
      record.chart.files,
      (i) => format.chartSlotFieldOffset(i),
      "u32",
    ),
    sound: usedFields(
      record.chart.sounds,
      (i) => format.soundFieldOffset(i),
      "u16",
    ),
    video: usedFields(
      record.video.primary,
      (i) => format.videoFieldOffset(i),
      "u32",
    ),
  };
}

export function writeEntryVersion(
  format: PbEntryFormat,
  entry: Uint8Array,
  version: number,
): void {
  format.recordOf(entry).selection.origin = version;
}

/**
 * 難易度の欄を、譜面を持たない難易度と同じ値にする。
 * PB原盤の譜面を持たない難易度は、レベル・譜面・ノーツ数の欄がすべて0である(PB実測)
 */
export function clearChartFields(
  format: PbEntryFormat,
  entry: Uint8Array,
  name: string,
): void {
  const { levelIndex, notesIndices } = difficultyOf(name);
  const chartSlot = format.chartSlotOf(name);
  const record = format.recordOf(entry);
  record.selection.levels = record.selection.levels
    .map((level, i) => i === levelIndex ? 0 : level);
  record.chart.files = record.chart.files
    .map((file, i) => i === chartSlot ? 0 : file);
  record.chart.notes = (record.chart.notes ?? [])
    .map((count, i) => notesIndices.includes(i) ? 0 : count);
}

/**
 * 符号化済みのエントリのムービーを、別の曲のムービーに参照させる。
 * `flags`は`VIDEO_FLAG_BITS`の範囲で、他のbitは元のまま残す。
 * `abcIndex`があれば、`fields`の各フィールドをそのABC indexへ書き換える。
 */
export function redirectEntryVideo(
  format: PbEntryFormat,
  encoded: string,
  flags: number,
  fields: readonly number[],
  abcIndex: number | undefined,
): string {
  const entry = format.decode(encoded);
  const record = format.recordOf(entry);
  record.video.unkPb62 = ((record.video.unkPb62 ?? 0) & ~VIDEO_FLAG_BITS) |
    flags;
  if (abcIndex !== undefined) {
    const view = new DataView(entry.buffer, entry.byteOffset, entry.byteLength);
    fields.forEach((field) => view.setUint32(field, abcIndex, true));
  }
  return format.encode(entry);
}

/** 全曲リストで外した譜面の欄を、譜面を持たない難易度と同じ値にした写しを返す */
export function withoutChartFields(
  format: PbEntryFormat,
  entry: Uint8Array,
  names: readonly string[],
): Uint8Array {
  const out = entry.slice();
  names.forEach((name) => clearChartFields(format, out, name));
  return out;
}

/** 音の欄に書く1件。`pair`は譜面の組の難易度名 */
export interface SoundFieldWrite {
  index: number;
  kind: "bgm" | "keysound";
  pair: string;
}

/** 符号化済みのエントリの音の欄に、ABC indexを書く */
export function writeSoundFields(
  format: PbEntryFormat,
  encoded: string,
  writes: readonly SoundFieldWrite[],
): string {
  const entry = format.decode(encoded);
  const view = new DataView(entry.buffer);
  for (const { index, kind, pair } of writes) {
    const offset = kind === "bgm"
      ? format.bgmFieldOffset(pair)
      : format.keysoundFieldOffset(pair);
    view.setUint16(offset, index, true);
  }
  return format.encode(entry);
}
