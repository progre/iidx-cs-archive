// era1(3rd〜8th)の曲DBから、曲が参照するムービーを重複なく列挙する。
// 1曲に2本ある作品では、同じ曲の相方ファイルをpartnerとして持たせる。

import type { Era1Song, Era1Source, Era1Video } from "../types.ts";

interface VideoEntry {
  archive: string;
  index: number;
  offset: number;
  size: number;
}

/** 曲DBの1曲ぶん。entriesは欄の順(本目の順)のムービー */
export interface Era1SongRecord {
  entries: VideoEntry[];
  id: number;
  title: string;
}

/** 拡張子を除いたアーカイブ名と、表の行の4桁 */
export const videoKeyOf = ({ archive, index }: VideoEntry): string =>
  `${archive.toUpperCase().replace(/\.[^.]*$/, "")}_${
    String(index).padStart(4, "0")
  }`;

export function buildEra1Source(
  generation: string,
  records: Era1SongRecord[],
): Era1Source {
  const videos = new Map<string, Era1Video>();
  const songs: Era1Song[] = [];
  for (const { entries, id, title } of records) {
    const keys = entries.map(videoKeyOf);
    songs.push({ id, videos: keys });
    entries.forEach((entry, slot) => {
      const key = keys[slot];
      const known = videos.get(key);
      if (known) {
        known.songCount++;
        return;
      }
      videos.set(key, {
        ...entry,
        generation,
        key,
        partner: keys.length === 2 ? keys[1 - slot] : null,
        slot,
        songCount: 1,
        title,
      });
    });
  }
  const sorted = [...videos.values()].sort((a, b) =>
    a.key < b.key ? -1 : a.key > b.key ? 1 : 0
  );
  return { songs, videos: sorted };
}
