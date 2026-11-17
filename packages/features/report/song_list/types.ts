// 曲リストHTMLのデータ。`data/`が組み、`view/`はこのデータだけを読む。

import type { ChartPrint, SoundPrint } from "@csa/core";

export interface Difficulty {
  label: string;
  /** `SongRow.charts`のキー */
  name: string;
  /** 見出しに併記する譜面スロット番号 */
  slot: number;
}

/** 曲が使う資産のうち、同じものを何曲で共有しているかを数える単位 */
export interface SharedAsset {
  bytes: number;
  id: string;
}

export interface Video {
  /** CSAでの番号 */
  id?: number;
  /** 原作のムービーの識別子。共有BGAへ向けた曲と、ムービーを差し替えた曲だけが持つ */
  original?: string;
  /** 素材側の識別子。共有もこれで数える */
  source: string;
}

export interface ChartFrom {
  /** 難易度名 */
  chart: string;
  /** 別の曲の譜面なら、その曲の世代。同じ曲の中で移した譜面は持たない */
  generation?: string;
}

export interface Chart {
  /** 補正で変わったレベルの、補正前の値 */
  before?: number;
  /** 全曲リストで`x`を書いた、収録しない譜面 */
  excluded?: true;
  level: number;
  /** ほかの欄へ移した譜面。この欄の難易度では演奏しない */
  linked?: true;
  notes: number;
  /** 譜面の中身のハッシュ。tick に依らないので、世代をまたいで比べられる */
  print?: ChartPrint;
}

/**
 * ほかの難易度の譜面を演奏する欄に入る譜面。持つ譜面は次の2つである。
 * - 裏の曲の中で移した譜面
 * - 表の曲に無く、裏の曲から出す譜面(`front_charts`)
 */
export interface MovedInChart extends Chart {
  from: ChartFrom;
}

export interface SongRow {
  /** 曲が自前で持つ譜面のレベルとノーツ数。キーは難易度名。外した譜面も含む */
  charts: Record<string, Chart>;
  /** 曲が入る組の、全曲リストの`edition`。裏エントリーは表の曲の値を持つ */
  edition?: string;
  /** ほかの難易度か裏の曲から、その難易度の欄へ入る譜面。キーは移し先の難易度名 */
  movedIn?: Record<string, MovedInChart>;
  folder: string;
  /** 全曲リストの`folder`列で枠を変えたなら、規則が決める枠の略号。規則で決まらなければ`null` */
  folderBefore?: string | null;
  folderOrder: number;
  generation: string;
  /** 実機の選曲リストに並ぶ曲。裏エントリーと外した曲は並ばない */
  inSelectList: boolean;
  key: string;
  /** 全曲リストの`note` */
  note?: string;
  /** 原盤にもとから入っている曲。追加した曲と見分けて数える */
  original: boolean;
  overlayPackages: SharedAsset[];
  overlaySheets: number;
  /** CSAから外した曲 */
  removed: boolean;
  /** セーブデータの中の位置。曲DBの曲indexと同じで、選曲できる曲だけが持つ */
  saveIndex?: number;
  /** PB原盤の曲のsong_id。この曲は、その曲の音とオーバーレイを使う(全曲リストの`share`) */
  sharedWith?: number;
  /** 原盤の曲DBでの番号(song_id)。世代と合わせて、全曲リストの行を引ける */
  songId: number;
  soundBytes: number;
  /** 音の素材側の識別子 */
  sounds: string[];
  /** 原作フォルダーの略号か新旧の印 */
  sourceFolder?: string;
  /** 全曲リストの`subtitle` */
  subtitle?: string;
  title: string;
  /** 裏エントリーと5鍵盤版だけが持つ、表の曲 */
  variantFor?: VariantFor;
  videoBytes: number;
  videos: Video[];
}

export interface VariantFor {
  /** 表の曲の管理名 */
  front: string;
  /** 表の曲の世代 */
  frontGeneration: string;
  /** 表の曲の曲index。同じ曲番号の表が2つあっても、表の行を1つに決められる */
  frontIndex: number;
  /** 表の曲のsong_id */
  frontSongId: number;
  /** `custom`の裏の番号。表の曲ごとに振る */
  position?: number;
  /** 差し替えの条件。5鍵盤版は`5keys` */
  rule: string;
}

export interface SongListData {
  /** ムービーとオーバーレイの素材側の識別子 → 中身のハッシュ */
  contentPrints: ReadonlyMap<string, string>;
  difficulties: Difficulty[];
  label: string;
  /** ムービーの`世代:番号` → 別名 */
  movieAliases: ReadonlyMap<string, string>;
  /** 表に出す順に並べておく */
  songs: SongRow[];
  /** 音の素材側の識別子 → 本体とヘッダーのハッシュ */
  soundPrints: ReadonlyMap<string, SoundPrint>;
}
