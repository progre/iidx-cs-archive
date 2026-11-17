// 資産の共有。識別子ごとに、それを使う曲を集める。
// この一覧に載る曲だけを数えるので、曲数はそのまま同じ識別子の並ぶ行数になる。

import type { SongRow } from "../types.ts";

/** 識別子 → その資産を使う曲 */
export type Sharing<Key> = ReadonlyMap<Key, readonly string[]>;

function collect<Key>(
  songs: readonly SongRow[],
  keysOf: (song: SongRow) => readonly Key[],
): Map<Key, string[]> {
  const sharing = new Map<Key, string[]>();
  for (const song of songs) {
    for (const key of keysOf(song)) {
      const found = sharing.get(key) ?? [];
      found.push(song.generation + " " + song.title);
      sharing.set(key, found);
    }
  }
  return sharing;
}

/** CSAの番号ではなく、素材側の識別子で数える */
export const videoSharing = (songs: readonly SongRow[]): Sharing<string> =>
  collect(songs, (song) => song.videos.map((each) => each.source));

export const overlaySharing = (songs: readonly SongRow[]): Sharing<string> =>
  collect(songs, (song) => song.overlayPackages.map((each) => each.id));
