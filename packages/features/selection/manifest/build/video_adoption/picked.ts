// 差し替え表で採用元を別名で書いた行を、採用元の曲と何本目かに引き直す。
// 採用するのは、`movie_alias.csv`で別名の`pick`に`*`を書いた1本である。

import type {
  AdoptionSources,
  SongId,
  VideoAdoption,
  VideoAdoptionRow,
} from "../adoption/mod.ts";
import { FLAG_BITS, keyOf, usableVideoOf, videosOfRows } from "./adopted.ts";

const PB = "pb";

/** 別名の`pick`の1本。`id`は世代のファイル番号で、PBではABC indexである */
export interface PickedMovie {
  generation: string;
  id: number;
}

function fail(message: string): never {
  throw new Error(message);
}

/** PBの1本は、そのABC indexを持つPBの曲から引く。曲どうしでムービーの印が違えば、どれに合わせるか決まらない */
function pbAdoptOf(sources: AdoptionSources, movie: PickedMovie): SongId {
  const songs = sources.pbSongmap.songs
    .filter(({ videos }) => videos.length === 1 && videos[0] === movie.id)
    .map(({ song_id }) => ({ generation: PB, songId: song_id }));
  const adopt = songs.at(0) ??
    fail(`pbの${movie.id}だけを持つPBの曲が無い`);
  const flagsOf = (song: SongId) => sources.videoFlagsOf(song) & FLAG_BITS;
  const differ = songs.filter((song) => flagsOf(song) !== flagsOf(adopt));
  if (differ.length > 0) {
    fail(
      `pb:${movie.id}を持つ曲でムービーの印が違う: ${
        [adopt, ...differ].map(keyOf).join(", ")
      }`,
    );
  }
  return adopt;
}

function ubAdoptOf(
  sources: AdoptionSources,
  movie: PickedMovie,
): Pick<VideoAdoption, "adopt" | "adoptSlot"> {
  const rows = sources.songs.filter(({ sourceGeneration }) =>
    sourceGeneration === movie.generation
  );
  const holder =
    rows.find(({ sourceAssets }) =>
      usableVideoOf(sourceAssets).some(({ sourceFileIndex }) =>
        sourceFileIndex === movie.id
      )
    ) ?? fail(`${movie.generation}:${movie.id}を持つ曲が載せる候補に無い`);
  const songId = holder.sourceSongIndex;
  const adoptSlot = videosOfRows(
    rows.filter(({ sourceSongIndex }) => sourceSongIndex === songId),
  ).findIndex(({ sourceFileIndex }) => sourceFileIndex === movie.id);
  return { adopt: { generation: movie.generation, songId }, adoptSlot };
}

export function adoptionsOf(
  rows: readonly VideoAdoptionRow[],
  picks: ReadonlyMap<string, PickedMovie>,
  sources: AdoptionSources,
): VideoAdoption[] {
  return rows.map((row) => {
    if (!("alias" in row)) {
      return row;
    }
    const movie = picks.get(row.alias) ??
      fail(`別名${row.alias}のpickがmovie_alias.csvに無い`);
    const { song, slot } = row;
    return movie.generation === PB
      ? { song, slot, adopt: pbAdoptOf(sources, movie), adoptSlot: 0 }
      : { song, slot, ...ubAdoptOf(sources, movie) };
  });
}
