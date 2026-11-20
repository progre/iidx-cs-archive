// 曲リストのデータを組み、HTMLを1枚にする。
// sources/ が周回の結果から入力を組み、data/ がデータを組み、view/ がHTMLを組む。

import type { SongListData } from "./types.ts";
import { pageHtml } from "./view/mod.ts";

export {
  measureLap,
  type PbDisc,
  type PbSong,
  readPbSongs,
  soundLengthOf,
  type SoundMeasures,
} from "./sources/lap/mod.ts";
export type * from "./ports.ts";
export {
  type SongListLaps,
  type SongListOptions,
  type SongListRun,
  writeSongListFiles,
} from "./sources/mod.ts";

export { soundSourceOf } from "./data/rows/mod.ts";
export type * from "./data/mod.ts";
export type * from "./types.ts";

/** `songListFiles`が書いたJSONを、HTMLを組めるデータに戻す */
export function songListDataOfJson(json: string): SongListData {
  const data = JSON.parse(json);
  return {
    ...data,
    contentPrints: new Map(Object.entries(data.contentPrints)),
    movieAliases: new Map(Object.entries(data.movieAliases)),
    soundPrints: new Map(Object.entries(data.soundPrints)),
  };
}

/** JSONからHTMLだけを組み直す。表示だけを変えたとき、ビルドを回さずに確かめるのに使う */
export const songListHtmlOfJson = (json: string): string =>
  pageHtml(songListDataOfJson(json));
