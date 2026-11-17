// 曲名順に使う題名を、追加する曲の曲DBエントリーへ書く。
// PB原盤の曲は manifest に載らないので書き換えず、同じ曲の版を並べる土台にだけ使う。

import type { ManifestPbBack, ManifestSong, SongmapSong } from "@csa/core";
import type { IndexDoc, IndexTitleOf } from "../../index/mod.ts";
import type { SortTitlePorts } from "./ports.ts";
import { songIdOf, sortTitlesOf, type TitledSong } from "./titles.ts";

const PB = "pb";

/** 索引に載らないPBの曲は、`pb:song_id`をキーにする。曲リストと同じ規則である */
function pbSongsOf(
  pbSongs: readonly SongmapSong[],
  index: IndexDoc,
): TitledSong[] {
  const keys = new Map(
    Object.entries(index.songs).flatMap(([key, entry]) =>
      (entry.generations.pb ?? []).map((song) => [song.song_id, key] as const)
    ),
  );
  return pbSongs
    .filter((song) => Object.keys(song.charts).length > 0)
    .map((song) => ({
      generation: PB,
      key: keys.get(song.song_id) ?? songIdOf(PB, song.song_id),
      listed: true,
      songId: song.song_id,
      title: song.title,
    }));
}

function titledOf(
  songs: readonly ManifestSong[],
  ports: SortTitlePorts,
): TitledSong[] {
  const byTarget = new Map(
    songs.map((song) => [
      song.targetSongIndex,
      songIdOf(song.sourceGeneration, song.sourceSongIndex),
    ]),
  );
  return songs.map((song) => {
    const front = song.fiveKeyOf?.targetSongIndex;
    const row = ports.catalogRowAt(song.sourceGeneration, song.catalogLine);
    return {
      ...(front === undefined
        ? {}
        : { fiveKeyOf: byTarget.get(front) ?? songIdOf(PB, front) }),
      generation: song.sourceGeneration,
      ...(row?.edition == null ? {} : { edition: row.edition }),
      ...(row === undefined ? {} : { indexTitle: row.indexTitle }),
      key: song.canonicalKey,
      listed: song.variantOf === undefined,
      songId: song.sourceSongIndex,
      title: ports.titleOf(song.entry),
    };
  });
}

const startsWithLetter = (title: string) => /^[A-Z]/.test(title);

/**
 * OTHERSの印は、題名の先頭が英字かどうかで決めてある。そのため、英字かどうかが変わる題名は書けない。
 * 頭文字フォルダーは、実機が題名の先頭の文字で決めるので、新しい題名に従う
 */
function withTitle<T extends ManifestSong>(
  song: T,
  title: string,
  ports: SortTitlePorts,
): T {
  const current = ports.titleOf(song.entry);
  if (startsWithLetter(current) !== startsWithLetter(title)) {
    throw new Error(
      `${song.sourceGeneration}:${song.sourceSongIndex}の題名の先頭が、英字かどうかで変わる: ` +
        `${current} → ${title}`,
    );
  }
  return { ...song, entry: ports.withTitle(song.entry, title) };
}

/**
 * `pbBacks`は、表の曲に枠を譲って裏になったPB原盤の曲である。
 * 選曲リストに並ばないので、同じ曲の版を並べる土台にしない
 */
export function withSortTitles<T extends ManifestSong>(
  songs: readonly T[],
  pbSongs: readonly SongmapSong[],
  pbBacks: readonly Pick<ManifestPbBack, "songId">[],
  index: IndexDoc,
  indexTitleOf: IndexTitleOf,
  ports: SortTitlePorts,
): T[] {
  const backs = new Set(pbBacks.map(({ songId }) => songId));
  const titles = sortTitlesOf(
    titledOf(songs, ports),
    pbSongsOf(pbSongs.filter((song) => !backs.has(song.song_id)), index),
    indexTitleOf,
    ports.generations,
  );
  return songs.map((song) => {
    const title = titles.get(
      songIdOf(song.sourceGeneration, song.sourceSongIndex),
    );
    return title === undefined ? song : withTitle(song, title, ports);
  });
}
