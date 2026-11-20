// 収録の候補の曲が持つ欄の型。原盤を読む features と、曲を組む features の両方が使う。
// 収録の候補の1曲は、周回で原盤から作り、決まった値から欄を埋める。全部の欄が埋まると`ManifestSong`になる。

import type {
  AssetKind,
  ManifestAsset,
  ManifestSong,
  SourceSlice,
  SwitchRule,
} from "./manifest.ts";
import type { ManifestOverlay, ManifestTitleCard } from "./song_display.ts";

/**
 * 資産の経路。`source`=譜面と音を収録する、`copy`=動画を無変換で写す、
 * `reencode`=動画を再符号化する(era1ムービー)、`excluded`=収録しない
 */
export type ConversionPath = "copy" | "excluded" | "reencode" | "source";

export interface Resolution {
  height: number;
  width: number;
}

/** 素材の曲DBが持つ、作品番号か新旧の印。どちらの欄も無い4th・USは、どちらも持たない */
export interface SourceOrigin {
  /** 3rd・5th〜7thの新旧の印 */
  newOld?: number;
  /** 8th以降の作品番号 */
  sourceVersion?: number;
}

/** 曲ごとのオーバーレイ。曲DBエントリの欄から読む */
export interface SongOverlay {
  /** 読み込む`.if`のDATA1 index。3rd〜8thは主アーカイブなので空で、songmapが持つ */
  packages: number[];
  /** 演奏中に使う枚数 */
  sheets: number;
}

/** 5鍵盤版の表の曲 */
export interface FiveKeyFront {
  /** 表の曲の世代。5鍵盤版と同じ世代なら持たない */
  generation?: string;
  /** 全曲リストで書いた組なら`true`。5鍵盤版は、表の曲のレベルを写さず、自分のレベルを使う */
  ownLevels?: true;
  songId: number;
}

/** 裏エントリーが差し替え先になる表の曲 */
export interface SongVariant {
  /** `previousSong`で、直前に演奏していると切り替わる曲のsong_id */
  afterSongId?: number;
  /** `custom`で、表の曲が持たない難易度 → それを出す裏の曲の難易度。`sp_black`の形 */
  chartMoves?: Record<string, string>;
  /** 表の曲の世代。書かなければ裏と同じ世代である。`pb`なら、PB原盤の曲を表にする */
  generation?: string;
  /**
   * 差し替え元(選曲リストに並ぶ側)の曲の、全曲リストでの行番号。
   * 全曲リストに2行で書いた曲では、2つの行がどちらも差し替え元のこともある。ビルドは、この番号で差し替え元の曲 index を探す
   */
  frontLine?: number;
  /** `custom`で、同じ表の曲の裏の中での番号。古い世代から順に0から振り、usは最後にする */
  position?: number;
  rule: SwitchRule;
  songId: number;
}

/**
 * 曲を採った世代の曲DBエントリから読んだ、オーバーレイのパッケージと枚数を持つ記録。曲リストはこの値を表示する。
 * 3rd〜8thのパッケージは、主アーカイブの`IFs`の番号である
 */
export interface WithSourceOverlay {
  sourceOverlay: SongOverlay;
}

/** 曲の素材の資産と、CSAへ載せる経路 */
export interface SourceAsset extends SourceSlice {
  /** この資産を指す曲DB上の欄。譜面は難易度名、音声はpair名、動画は本目(`0`/`1`) */
  fields: string[];
  kind: AssetKind;
  /** `reencode`の変換済みファイル */
  output?: string;
  path: ConversionPath;
  /** `copy`する動画の原盤解像度。480x480は曲DBのムービーの印の bit1 が要る */
  resolution?: Resolution;
}

/** 収録の候補の1曲。周回で作る欄 */
interface Candidate {
  /** 原作がANOTHERのときだけ別の曲名カードの絵を出す曲なら、その絵の番号 */
  anotherTitleCardSprite?: number;
  canonicalKey: string;
  /** 全曲リストの`exclude`で外した曲 */
  excluded?: true;
  /** 全曲リストで`x`を書いた、収録しない譜面の難易度名(`sp_another`など) */
  excludedCharts?: string[];
  /** 5鍵盤版なら、同じ世代の表の曲。曲indexは収録する曲を選んだ後に決まる */
  fiveKeyOf?: FiveKeyFront & { targetSongIndex?: number };
  /** 全曲リストの行に書いた難易度。全曲リストの譜面の列名 → 難易度 */
  catalogLevels?: Record<string, number>;
  /** 全曲リストでこの曲を書いた行の番号 */
  catalogLine?: number;
  /** 表の曲の中で譜面を移す組。移し先 → 移し元の難易度名 */
  chartMoves?: Record<string, string>;
  /** 全曲リストの`note`。外した曲では、外した理由を示す */
  note?: string;
  /** 表を PB 以外の版にした組の表の曲なら、PB 原盤の曲の song_id。曲は PB の曲の枠に置く */
  pbSlot?: number;
  /** オーバーレイをANOTHERのときだけ使う。原作がコードの分岐でそうしている曲に付ける */
  overlayOnlyAnother?: true;
  /** 全曲リストの`share`。音とオーバーレイを共有するPB原盤の曲の管理名 */
  share?: string;
  sourceAssets: SourceAsset[];
  sourceGeneration: string;
  sourceSongIndex: number;
  title: string;
  /** 選曲できない裏エントリーなら、差し替え元の曲と条件。曲indexは収録する曲を選んだ後に決まる */
  variantOf?: SongVariant & {
    afterTargetSongIndex?: number;
    targetSongIndex?: number;
  };
}

/** 下書きで決まる欄。曲DBエントリーは、作品番号を書く前の値である */
interface Drafted extends SourceOrigin, Partial<WithSourceOverlay> {
  assets?: ManifestAsset[];
  /** 作品番号を書く前の曲DBエントリー */
  draftEntry?: Uint8Array;
  overlay?: ManifestOverlay;
  titleCard?: ManifestTitleCard;
  videoFields?: number[];
}

/** 収録する曲を選んだ後に決まる欄 */
type Finished = Partial<
  Pick<ManifestSong, "entry" | "sharedWith" | "targetSongIndex" | "uncorrected">
>;

/** 収録の候補の1曲 */
export type ManifestSongDraft = Candidate & Drafted & Finished;

/** 収録する曲。manifestの1曲に、曲リストに出す、曲を採った世代の値を足す */
export type FinishedSong = ManifestSong & SourceOrigin & WithSourceOverlay;
