// 別名をもとに、曲が使うムービーを決める。
// 同じ別名のムービーは同じ映像なので、別名ごとに1本を選び、その別名のムービーを使う曲にはその1本を使わせる。
// 選ぶ順は次のとおりである。どれも、CSAが採れるムービーに限る。
// - PBの曲が単独で持つムービー。PBのファイルを使うので、CSAにファイルを足さずに済む
// - CSAがムービーを変換しない世代のうち、いちばん古い世代のムービー
// - 変換する世代のうち、優先する世代(`preferredConvertedGeneration`)のムービー
// - 別名の先頭のムービー
// `_short`の別名のムービーを使う曲は、`_short`を除いた別名の1本を使う。

import type { AdoptionSources, AliasAdoption } from "../../adoption/mod.ts";
import { keyOf, usableVideoOf } from "../adopted.ts";

const PB = "pb";
const SHORT = "_short";

/** 別名の1本。`id`は世代のファイル番号で、PBではABC indexである */
export interface PickedMovie {
  generation: string;
  id: number;
}

export interface AliasRules {
  /** `世代:番号` → 別名。並びは表の行の順である */
  aliases: ReadonlyMap<string, string>;
  /** CSAがその世代のムービーを変換するか */
  convertsVideo: (generation: string) => boolean;
  /** 発売順の世代。PBを含まない */
  generations: readonly string[];
  /** 変換する世代の中で優先する世代。大きな解像度のムービーを持つ世代を渡す */
  preferredConvertedGeneration: string;
}

const movieOf = (key: string): PickedMovie => {
  const at = key.indexOf(":");
  return { generation: key.slice(0, at), id: Number(key.slice(at + 1)) };
};

/**
 * CSAが採れるムービーか。
 * PBのムービーは、そのムービーだけを持つPBの曲があれば採れる。
 * PB以外のムービーは、載せる候補の曲のどれかがそのムービーを使っていれば採れる
 */
function isAvailable(sources: AdoptionSources, movie: PickedMovie): boolean {
  if (movie.generation === PB) {
    return sources.pbSongmap.songs.some(({ videos }) =>
      videos.length === 1 && videos[0] === movie.id
    );
  }
  return sources.songs.some((song) =>
    song.sourceGeneration === movie.generation &&
    usableVideoOf(song.sourceAssets).some(({ sourceFileIndex }) =>
      sourceFileIndex === movie.id
    )
  );
}

/** 別名ごとに、採る1本を返す関数を作る。採れるムービーが無い別名は`undefined`である */
export function aliasPickerOf(
  rules: AliasRules,
  sources: AdoptionSources,
): (alias: string) => PickedMovie | undefined {
  const order = (generation: string) => rules.generations.indexOf(generation);
  const cache = new Map<string, PickedMovie | undefined>();
  const pick = (alias: string): PickedMovie | undefined => {
    const movies = [...rules.aliases]
      .filter(([, each]) => each === alias)
      .map(([key]) => movieOf(key))
      .filter((movie) => isAvailable(sources, movie));
    const unconverted = movies
      .filter(({ generation }) =>
        generation !== PB && !rules.convertsVideo(generation)
      )
      .toSorted((a, b) => order(a.generation) - order(b.generation));
    const preferred = movies.find(({ generation }) =>
      generation === rules.preferredConvertedGeneration
    );
    return movies.find(({ generation }) => generation === PB) ??
      unconverted.at(0) ?? preferred ?? movies.at(0);
  };
  return (alias) => {
    if (!cache.has(alias)) {
      cache.set(alias, pick(alias));
    }
    return cache.get(alias);
  };
}

/** `_short`の別名は、`_short`を除いた別名が表にあれば、そちらにする */
function targetAliasOf(alias: string, names: ReadonlySet<string>): string {
  const full = alias.slice(0, -SHORT.length);
  return alias.endsWith(SHORT) && names.has(full) ? full : alias;
}

/** 曲のムービーを、`slot`(ファイル番号の順の何本目か)と`世代:番号`で並べる */
function moviesOfSongs(sources: AdoptionSources) {
  const candidates = Map.groupBy(
    sources.songs.filter(({ sourceGeneration }) => sourceGeneration !== PB),
    (song) =>
      keyOf({
        generation: song.sourceGeneration,
        songId: song.sourceSongIndex,
      }),
  );
  const fromCandidates = [...candidates.values()].flatMap((rows) => {
    const { sourceGeneration: generation, sourceSongIndex: songId } = rows[0];
    // 何本目かは、資産を指す曲DBの欄(`fields`の`0`/`1`)で数える。差し替えを当てる処理の`slot`と同じ数え方である
    const bySlot = new Map(
      rows.flatMap(({ sourceAssets }) => usableVideoOf(sourceAssets))
        .flatMap(({ fields, sourceFileIndex }) =>
          fields.map((field) =>
            [Number(field), `${generation}:${sourceFileIndex}`] as const
          )
        ),
    );
    return [...bySlot].map(([slot, movie]) => ({
      song: { generation, songId },
      slot,
      movie,
    }));
  });
  const fromPb = sources.pbSongmap.songs.flatMap(({ song_id, videos }) =>
    videos.map((id, slot) => ({
      song: { generation: PB, songId: song_id },
      slot,
      movie: `${PB}:${id}`,
    }))
  );
  return [...fromCandidates, ...fromPb];
}

/**
 * 別名のムービーを使う曲に、別名の1本を使わせる行を作る。
 * 曲のムービーがその1本なら、行は作らない
 */
export function aliasAdoptionsOf(
  rules: AliasRules,
  pick: (alias: string) => PickedMovie | undefined,
  sources: AdoptionSources,
): AliasAdoption[] {
  const names = new Set(rules.aliases.values());
  return moviesOfSongs(sources).flatMap(({ song, slot, movie }) => {
    const alias = rules.aliases.get(movie);
    if (alias === undefined) {
      return [];
    }
    const target = targetAliasOf(alias, names);
    const picked = pick(target);
    if (picked === undefined || `${picked.generation}:${picked.id}` === movie) {
      return [];
    }
    return [{ song, slot, alias: target }];
  });
}
