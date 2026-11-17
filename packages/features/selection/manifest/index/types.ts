// 世代を横断する索引の型。

import type { SongmapChart } from "@csa/core";

/** 索引へ入れる世代の1曲。世代別のsongmapの曲が満たす形 */
export interface IndexSource {
  song_id: number;
  title: string;
  charts: Record<string, SongmapChart>;
  keysound: number | null;
  bgm: number | null;
  videos: number[];
}

export interface IndexInput {
  generation: string;
  songs: readonly IndexSource[];
}

/** 世代とsong_idから、全曲リストの`index_title`列に書いた曲名を引く。書いていなければnull */
export type IndexTitleOf = (
  generation: string,
  songId: number,
) => string | null;

/** 索引の世代別エントリ。世代ごとのsongmapと違い曲名を持たない */
export interface IndexGenerationEntry {
  song_id: number;
  charts: Record<string, SongmapChart>;
  keysound: number | null;
  bgm: number | null;
  videos: number[];
}

export interface IndexSongEntry {
  titles: string[];
  generations: Record<string, IndexGenerationEntry[]>;
}

export interface IndexDoc {
  generations: string[];
  /** 結合キー → 曲。キーは符号位置の順 */
  songs: Record<string, IndexSongEntry>;
}
