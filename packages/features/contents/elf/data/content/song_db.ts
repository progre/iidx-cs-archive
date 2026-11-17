/**
 * CSAのELFに書く曲DBエントリーの形。オフセットはPBの世代の定義が持つ。
 * 譜面の並びとレベルの対応は、PB形式のエントリーを扱う側(`PbEntryFormat`)が持つので、その形で受け取る。
 */

import type { ElfDefinition, SingleSlot, SongOriginLayout } from "@csa/core";

/** PB形式の曲DBエントリーの形。`@csa/contents-song-db`の`PbEntryFormat`がこの形を満たす */
export interface EntryFormat {
  readonly definition: ElfDefinition;
  /** 難易度のBGM(u16)のオフセット */
  bgmFieldOffset(name: string): number;
  /** 難易度の譜面(u32)のオフセット */
  chartFieldOffset(name: string): number;
  /** 難易度のキー音(u16)のオフセット */
  keysoundFieldOffset(name: string): number;
  /** 難易度のノーツ数(u16)のオフセット。SPは1つ、DPは1Pと2Pの2つ */
  notesFieldOffsets(name: string): number[];
  /** 譜面の並びの`slot`番目の欄のオフセット */
  chartSlotFieldOffset(slot: number): number;
  /** 譜面の欄のオフセットから、その難易度名を引く */
  difficultyNameOfChartField(fieldOffset: number): string;
  /** 難易度のレベル(u8)のオフセット */
  levelFieldOffset(name: string): number;
}

/** CSAのELFの曲DB。先頭の仮想アドレスと、エントリーの形を持つ */
export interface CsaSongDb {
  format: EntryFormat;
  vaddr: number;
}

/** `index`番目のエントリーの先頭の仮想アドレス */
export const entryAddressOf = ({ format, vaddr }: CsaSongDb, index: number) =>
  vaddr + index * format.definition.songDbRecordLength;

export const layoutOf = (format: EntryFormat) =>
  format.definition.songDbRecordLayout;

function required<T>(value: T | null, name: string): T {
  if (value === null) {
    throw new Error(`PBの定義に${name}が無い`);
  }
  return value;
}

/** 名前順OTHERSの印 */
export const othersOf = (format: EntryFormat): SingleSlot =>
  required(layoutOf(format).selection.others, "OTHERSの印");

/** 作品番号 */
export const versionOf = (format: EntryFormat): SongOriginLayout =>
  required(layoutOf(format).selection.origin, "作品番号");

/** 下位2bitがムービーの映し方(bit0=横に引き伸ばす、bit1=480x480) */
export const VIDEO_FLAG_BITS = 0x03;

/** ムービーの映し方の印(u8) */
export const videoFlagsOffsetOf = (format: EntryFormat): number =>
  required(layoutOf(format).video.unkPb62Offset, "ムービーの映し方の印");
