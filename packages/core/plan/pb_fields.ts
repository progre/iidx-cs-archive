// manifest が PB原盤の曲について持つ値。PB原盤の曲は manifest の曲に載らないので、曲とは別に持つ。

import type { ManifestAsset } from "./manifest.ts";

/** PB原盤の曲の、全曲リストで書いた難易度。曲DBへ書くときに、PB原盤のエントリーへ書き込む */
export interface PbLevels {
  /** 難易度名 → レベル */
  levels: Record<string, number>;
  songIndex: number;
}

/** PB原盤の曲の、全曲リストの`folder`で決めた作品番号。CSAの作品番号の意味で持つ */
export interface PbVersion {
  songIndex: number;
  version: number;
}

/**
 * 採用しない版を使うPBの曲を、採用した版へ向ける。
 * 採用した版がPBにあれば、そのABC indexを持つ。CSAが置く資産なら、その資産を持つ。
 * 資産のABC indexは配置の段階で決まるので、そこで引く
 */
export type PbVideoRedirect =
  & {
    /** 曲DB`+0x62`の下位2bit。採用した版の元の曲に合わせる */
    flags: number;
    songIndex: number;
  }
  & ({ abcIndex: number } | { asset: ManifestAsset });

/** どの曲も指さなくなったPBのファイル。追加する資産を置ける */
export interface FreedPbFile {
  abcIndex: number;
  archive: string;
  offset: number;
  size: number;
}

/**
 * 表を PB 以外の版にした組の、PB 原盤の曲の写し。選んで出す裏(`custom`)になる。
 * 表の曲は PB の曲の枠(`songId`)に置くので、写しは表を書く前の枠のエントリーを使う
 */
export interface ManifestPbBack {
  /** 表の曲が持たない難易度を鳴らす裏なら`true`(`ManifestVariant`と同じ) */
  forcedBack?: true;
  /** 表の曲が持たない難易度 → それを出すこの裏の難易度(`ManifestVariant`と同じ) */
  frontCharts?: Record<string, string>;
  /** 同じ表の曲の裏の中での番号 */
  position: number;
  /** PB 原盤の曲の song_id。表の曲の枠でもある */
  songId: number;
  targetSongIndex: number;
}
