// 全曲リストの`index_title`列を引き、世代を横断する曲の索引を作る。

import type { CatalogRow, SongmapSong } from "@csa/core";
import { buildSongIndex } from "./build.ts";
import type { IndexDoc, IndexTitleOf } from "./types.ts";

/** 全曲リストの`index_title`列を引く。世代の全曲リストは、初めて引くときに1回だけ曲DBと照合する */
export function indexTitlesOf<Elf>(
  catalogRowsOf: (
    generation: string,
    elf: Elf,
  ) => ReadonlyMap<number, CatalogRow>,
  elfOf: (generation: string) => Elf,
): IndexTitleOf {
  const byGeneration = new Map<string, Map<number, string>>();
  const titlesOf = (generation: string) => {
    const cached = byGeneration.get(generation);
    if (cached !== undefined) {
      return cached;
    }
    const titles = new Map(
      [...catalogRowsOf(generation, elfOf(generation))].flatMap((
        [songId, row],
      ) => row.indexTitle == null ? [] : [[songId, row.indexTitle] as const]),
    );
    byGeneration.set(generation, titles);
    return titles;
  };
  return (generation, songId) => titlesOf(generation).get(songId) ?? null;
}

/** 16世代のsongmapが要る。`generations`は索引の並びで、発売順で、PBが最後 */
export function songIndexOf(
  generations: readonly string[],
  songmapOf: (generation: string) => { songs: readonly SongmapSong[] },
  indexTitleOf: IndexTitleOf,
): IndexDoc {
  const inputs = generations.map((generation) => ({
    generation,
    songs: songmapOf(generation).songs,
  }));
  return buildSongIndex(inputs, indexTitleOf);
}
