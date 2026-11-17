// 曲リストが読む値の型。値を作る feature と、曲リストの両方が使う。

import type {
  FinishedSong,
  ManifestSongDraft,
  WithSourceOverlay,
} from "./candidate.ts";
import type { IndividualAssetManifest, ManifestSong } from "./manifest.ts";

/** 比べるための譜面の形 */
export interface ChartShape {
  /** `1P・2P.鍵盤` → そのノーツの tick を小さい順に */
  keys: Record<string, number[]>;
}

/**
 * 2つの譜面を比べた結果。
 * - `layout`: 配置が違う。鍵盤ごとのノーツ数が違うか、そろえた後の tick の差が許容を超えるノーツがある
 * - `bpm`: 縮尺が1から離れすぎていて、BPM が違う
 * - 数: 一致割合。そろえた後の tick の差が丸めの範囲に収まったノーツの割合
 */
export type ShapeComparison = "bpm" | "layout" | number;

/** どちらも8桁の16進 */
export interface ChartPrint {
  /** ノーツの並びと判定の値 */
  all: string;
  /** ノーツの並びだけ */
  notes: string;
  /** 同じ譜面を持つ版のうち、代表の版を`世代:song_id`で示す。値は曲リストが入れる */
  same?: string;
  /**
   * 同じ曲・同じ難易度で、表にする版の譜面と比べた結果。曲リストが付ける。
   * `against`は比べた版の`世代:song_id`である。表にする版の譜面自身は持たない
   */
  compare?: { against: string; result: ShapeComparison };
  /**
   * 裏の曲で移した譜面は、移し先の難易度で比べる。
   * キーは移し先の難易度名とする。値は曲リストが入れる
   */
  moved?: Record<string, { against: string; result: ShapeComparison }>;
  /**
   * この譜面と同じ譜面の`世代:song_id/難易度名`。曲リストが付ける。
   * 相手は、同じ曲のうち版も難易度も違う譜面に限る。
   * 表に選ばれやすい版から順に並べる。
   * `front_charts`などで別の難易度へ移した譜面は、移し先で比べているので含めない
   */
  sameIn?: string[];
}

export type SoundPrintKind = "bgm" | "keysound";

export interface SoundPrint {
  body: string;
  header: string | null;
  kind: SoundPrintKind;
}

export interface ListUncorrected {
  /** 全曲リストの`folder`列が無ければ規則が決める枠。規則で決まらなければ`null` */
  folder?: number | null;
  /** 補正前のレベル。キーは難易度名 */
  levels?: Readonly<Record<string, number>>;
}

/** 曲DBエントリから読んだ、行の並び・収録フォルダー・レベル */
export interface ListEntry {
  /** 収録フォルダーの枠 */
  folder: number;
  /** 全難易度のレベル。キーは難易度名 */
  levels: Readonly<Record<string, number>>;
  /** 全難易度のノーツ数。キーは難易度名 */
  notes: Readonly<Record<string, number>>;
  /** 選曲リストの並びキー */
  sortKey: string;
  /** 補正で変わった値の、補正前の値 */
  uncorrected?: ListUncorrected;
  /** 曲DBのムービー欄が指すABC index */
  videoAbcIndex: number;
}

/** 全曲リストの`exclude`で外した曲。曲リストに載せるため、全曲リストの難易度だけを書いた曲DBエントリを持つ */
export type ExcludedSong =
  & ManifestSongDraft
  & Pick<ManifestSong, "assets" | "entry" | "videoFields">
  & WithSourceOverlay;

/** PBの曲index → 直した後の作品番号 */
export type PbVersions = ReadonlyMap<number, number>;

export type FinishedManifest = Omit<IndividualAssetManifest, "songs"> & {
  songs: FinishedSong[];
};
