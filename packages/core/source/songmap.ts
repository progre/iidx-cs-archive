// 世代のsongmapが持つ、1曲ぶんの素材の一覧。

export interface SongmapChart {
  chart: number;
  /** 一部の世代はプラグインの`struct.unpack`の戻り値のまま1要素の配列で入っている */
  level: number | number[];
}

export interface SongmapSoundPair {
  pair: string;
  keysound: number | null;
  bgm: number | null;
}

export interface SongmapSong {
  song_id: number;
  title: string;
  charts: Record<string, SongmapChart>;
  sounds: SongmapSoundPair[];
  keysound: number | null;
  bgm: number | null;
  videos: number[];
  /** 主アーカイブのオーバーレイ`.if`。欄が別の位置にある9th以降はnull */
  overlay: number | null;
}

export interface SongmapFile {
  /** 全アーカイブをつないだ通し番号 */
  index: number;
  archive: string;
  offset: number;
  size: number;
  refs: string[];
}

export interface SongmapDoc {
  executable: string;
  /** 6th〜8th の曲DBの archive 番号は、この配列の添字を指す */
  archives: string[];
  songs: SongmapSong[];
  files: SongmapFile[];
}
