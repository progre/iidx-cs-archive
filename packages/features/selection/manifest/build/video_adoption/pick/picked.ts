// 別名で差し替える行を、採用元の曲と何本目かに引き直す。
// 採用するのは、別名ごとに規則で選んだ1本である(`alias_rule.ts`)。

import type {
  AdoptionSources,
  AliasAdoption,
  SongId,
  VideoAdoption,
} from "../../adoption/mod.ts";
import { FLAG_BITS, keyOf, usableVideoOf, videosOfRows } from "../adopted.ts";
import type { PickedMovie } from "./alias_rule.ts";

const PB = "pb";

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
  rows: readonly AliasAdoption[],
  pick: (alias: string) => PickedMovie | undefined,
  sources: AdoptionSources,
): VideoAdoption[] {
  return rows.map(({ alias, song, slot }) => {
    const movie = pick(alias) ??
      fail(`別名${alias}に、CSAが採れるムービーが無い`);
    return movie.generation === PB
      ? { song, slot, adopt: pbAdoptOf(sources, movie), adoptSlot: 0 }
      : { song, slot, ...ubAdoptOf(sources, movie) };
  });
}
