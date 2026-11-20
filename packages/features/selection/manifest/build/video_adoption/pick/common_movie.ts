// 全曲リストの`common_movie`の組のキーから、ムービーの別名を作る。
// 同じ組の曲どうしは同じ映像なので、CSAが使うムービーに同じ別名を付ける。
// - `*`の曲は、曲名(索引のキー)が同じ曲どうしを1つの組にする
// - それ以外の値の曲は、その値が同じ曲どうしを1つの組にする。曲名が違ってもよい
// 別名を付けた後は、表の別名と同じ規則で1本を選ぶ。
// - 3rd〜8thの曲は、CSAが採る1本だけを集める(`usableVideoOf`)
// - 表で別名を付けたムービーは集めない。表の別名を優先する

import type { AdoptionSources, SongId } from "../../adoption/mod.ts";
import { usableVideoOf } from "../adopted.ts";

const PB = "pb";
/** 曲名でまとめる組の値 */
const BY_TITLE = "*";

export interface CommonMovieRules {
  /** `世代:番号` → 別名。表の別名である */
  aliases: ReadonlyMap<string, string>;
  /** 曲の`common_movie`の値。書いていなければ`undefined`である */
  commonMovieOf: (song: SongId) => string | undefined;
  /** 発売順の世代。PBを含まない */
  generations: readonly string[];
  /** 曲の索引のキー。索引に無い曲は`undefined`である */
  songKeyOf: (song: SongId) => string | undefined;
}

/** 組の別名。表の別名と重ならないように、接頭辞を付ける */
function aliasOf(rules: CommonMovieRules, song: SongId): string | undefined {
  const value = rules.commonMovieOf(song);
  if (value !== BY_TITLE) {
    return value === undefined ? undefined : `common:${value}`;
  }
  const key = rules.songKeyOf(song);
  return key === undefined ? undefined : `song:${key}`;
}

/** 組に入る曲が、CSAで使うムービー(`世代:番号`)と、その組の別名 */
function groupedMovies(rules: CommonMovieRules, sources: AdoptionSources) {
  const fromCandidates = sources.songs
    .filter(({ sourceGeneration }) => sourceGeneration !== PB)
    .flatMap((song) => {
      const id = {
        generation: song.sourceGeneration,
        songId: song.sourceSongIndex,
      };
      const alias = aliasOf(rules, id);
      return alias === undefined
        ? []
        : usableVideoOf(song.sourceAssets).map(({ sourceFileIndex }) => ({
          alias,
          movie: `${id.generation}:${sourceFileIndex}`,
        }));
    });
  const fromPb = sources.pbSongmap.songs.flatMap(({ song_id, videos }) => {
    const alias = aliasOf(rules, { generation: PB, songId: song_id });
    return alias === undefined
      ? []
      : videos.map((video) => ({ alias, movie: `${PB}:${video}` }));
  });
  return [...fromCandidates, ...fromPb];
}

/**
 * 表の別名に、組のキーから作った別名を足す。
 * 組のムービーが2本以上あるときだけ、別名を付ける。
 * ムービーは発売順の世代の順に並べ、PBを最後にする。
 * 1本のムービーが、2つの組の別名に入るときは止める
 */
export function withCommonMovieAliases(
  rules: CommonMovieRules,
  sources: AdoptionSources,
): Map<string, string> {
  const order = (movie: string) => {
    const generation = movie.slice(0, movie.indexOf(":"));
    return generation === PB
      ? rules.generations.length
      : rules.generations.indexOf(generation);
  };
  const keyed = groupedMovies(rules, sources)
    .filter(({ movie }) => !rules.aliases.has(movie));
  const derived = new Map<string, string>();
  for (const [alias, members] of Map.groupBy(keyed, ({ alias }) => alias)) {
    const movies = [...new Set(members.map(({ movie }) => movie))]
      .toSorted((a, b) => order(a) - order(b));
    if (movies.length < 2) {
      continue;
    }
    for (const movie of movies) {
      const other = derived.get(movie);
      if (other !== undefined && other !== alias) {
        throw new Error(`${movie}に、組の別名が2つ付く: ${other}, ${alias}`);
      }
      derived.set(movie, alias);
    }
  }
  return new Map([...rules.aliases, ...derived]);
}
