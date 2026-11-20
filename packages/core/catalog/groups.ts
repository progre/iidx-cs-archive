// 全曲リストから集めた組と、全曲リストに添える表の1行の型。

import type { CatalogRow } from "./rows.ts";

type CatalogRule = NonNullable<NonNullable<CatalogRow["front"]>["rule"]>;

/** 原作に無い裏エントリーの組1つ。`title`と`frontTitle`は、全曲リストの`title`列と同じ書き方である */
export interface CatalogVariant {
  /** 表の曲が持たない難易度 → それを出す裏の曲の難易度。どちらも`sp_black`の形 */
  chartMoves?: Record<string, string>;
  /** 表の曲の世代。裏と別の世代や`pb`でもよい */
  frontGeneration: string;
  /**
   * 組の表(選曲リストに並ぶ行)の行番号(1始まり)。
   * 全曲リストに2行で書いた曲では、2つの行がどちらも組の表のこともある
   */
  frontLine: number;
  frontTitle: string;
  /** 裏の曲の世代 */
  generation: string;
  /** 裏の曲の行の、全曲リストのファイルでの行番号(1始まり) */
  line: number;
  /** `custom`の裏の番号。表の曲ごとに0から振る。`rule`を持つ裏には振らない */
  position?: number;
  /** 原作の組と同じ条件で差し替える裏なら、その条件 */
  rule?: CatalogRule;
  /** 組のセーブの枠の持ち主なら`true`。表の曲は、この曲の曲indexに置く */
  slotOwner?: true;
  title: string;
}

/** 全曲リストに書いた5鍵盤版の組1つ。`title`と`frontTitle`は、全曲リストの`title`列と同じ書き方である */
export interface CatalogFiveKey {
  frontGeneration: string;
  frontTitle: string;
  /** 5鍵盤版の曲の世代 */
  generation: string;
  /** 行番号。5鍵盤版の曲は、全曲リストのこの行に書いてある。番号は1から数える */
  line: number;
  title: string;
}

/** 表の1行。`title`は全曲リストの`title`列と同じ書き方である */
export interface AnotherSwitchRow {
  generation: string;
  /** ファイルの行番号(1始まり) */
  line: number;
  /** オーバーレイをANOTHERのときだけ使う */
  overlayOnlyAnother: boolean;
  title: string;
  /** ANOTHERで出す曲名カードの絵の番号。指定が無ければ`null` */
  titleCardSprite: number | null;
  /** ANOTHERで流すムービーの、原盤のファイル表の通し番号。指定が無ければ`null` */
  video: number | null;
}

/** 共有の表の1行。`title`は全曲リストの`title`列と同じ書き方である */
export interface SharedAssetRow {
  generation: string;
  /** ファイルの行番号(1始まり) */
  line: number;
  /** 共有するPB原盤の曲の管理名 */
  share: string;
  title: string;
}
