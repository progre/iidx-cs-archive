export interface Era1Video {
  archive: string;
  generation: string;
  /** アーカイブの表の行 */
  index: number;
  /** 世代の中でファイルを一意に指す名前。変換出力のファイル名にも使う */
  key: string;
  offset: number;
  /** 同じ曲のもう1本のkey。1本しか無ければnull */
  partner: string | null;
  size: number;
  /** この曲の何本目か */
  slot: number;
  songCount: number;
  title: string;
}

export interface Era1Song {
  id: number;
  /** 曲が参照するムービーのkey。本目の順 */
  videos: string[];
}

export interface Era1Source {
  songs: Era1Song[];
  videos: Era1Video[];
}

export interface Crop {
  h: number;
  w: number;
  x: number;
  y: number;
}

export interface Era1Job {
  band: Crop;
  crop: Crop;
  songIds: number[];
  video: Era1Video;
}
