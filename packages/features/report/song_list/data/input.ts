// 曲リストのデータを組む入力。どれも CSA の曲の記録と、周回で原盤から読んだ値であり、ここでは原盤を読まない。
// 曲DBエントリの解読はPB形式の定義を持つ側が済ませ、読んだ値(`ListEntry`)を渡す。

import type {
  ChartPrint,
  IndividualAssetManifest,
  ListEntry,
  ManifestSong,
  SongmapSong,
  SongOverlay,
  SoundPrint,
  SourceOrigin,
  WithSourceOverlay,
} from "@csa/core";

/** 曲DBエントリから読んだ値 */
interface Shown {
  /** 難易度名 → 譜面の中身のハッシュ。全曲リストで外した譜面も持つ */
  chartPrints: Readonly<Record<string, ChartPrint>>;
  /** ゲームへ載る姿の曲DBエントリから読んだ値 */
  shown: ListEntry;
}

/** 収録する曲 */
export type ListedSong =
  & ManifestSong
  & SourceOrigin
  & WithSourceOverlay
  & Shown
  & {
    /** 譜面の資産がある難易度名 */
    chartNames: readonly string[];
  };

/** 全曲リストで外した曲。収録するときに置くはずだった資産も見せる */
export type ListedExcludedSong =
  & Pick<
    ManifestSong,
    | "assets"
    | "canonicalKey"
    | "catalogLine"
    | "excludedCharts"
    | "note"
    | "sourceGeneration"
    | "sourceSongIndex"
    | "title"
    | "videoFields"
  >
  & SourceOrigin
  & WithSourceOverlay
  & Shown;

/** PB原盤の曲 */
export interface ListedPbSong extends Shown {
  key: string;
  overlay: SongOverlay;
  song: SongmapSong;
}

export interface SongListInput {
  /** ムービーとオーバーレイの素材側の識別子 → 中身のハッシュ */
  contentPrints: ReadonlyMap<string, string>;
  /** 曲のキー(`catalogKeyOf`) → 全曲リストの`edition` */
  editions: ReadonlyMap<string, string>;
  excluded: readonly ListedExcludedSong[];
  label: string;
  /** 素材側の識別子 → 音・ムービー・オーバーレイの中身の長さ */
  lengths: ReadonlyMap<string, number>;
  manifest: Omit<IndividualAssetManifest, "songs"> & {
    songs: ListedSong[];
  };
  /** ムービーの`世代:番号` → 別名 */
  movieAliases: ReadonlyMap<string, string>;
  pbSongs: readonly ListedPbSong[];
  /** 音の素材側の識別子 → 本体とヘッダーのハッシュ */
  soundPrints: ReadonlyMap<string, SoundPrint>;
  /** 曲のキー(`catalogKeyOf`) → 全曲リストの`subtitle` */
  subtitles: ReadonlyMap<string, string>;
}
