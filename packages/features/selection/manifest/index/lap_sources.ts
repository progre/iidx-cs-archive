// 原盤から読んだ素材を、世代ごとに引く値。周回が作り、周回の後の処理が使う。
// songmapと索引は、メモリー上に持つ。`Elf`と`Lz`の中身は読まない。

import type { CatalogRow, SongmapDoc } from "@csa/core";
import { indexTitlesOf, songIndexOf } from "./titles.ts";
import type { IndexDoc, IndexTitleOf } from "./types.ts";

export interface LapSources<Elf, Lz> {
  /** 呼ぶたびにファイルから読む。曲ごとに呼ぶ場合は、世代ごとにまとめて呼ぶ */
  elfOf: (generation: string) => Elf;
  /** 世代のLZ済みの譜面の置き場 */
  lzOf: (generation: string) => Lz;
  songmapOf: (generation: string) => SongmapDoc;
  /** 世代を横断する索引 */
  index: IndexDoc;
  /** 全曲リストの`index_title`列 */
  indexTitleOf: IndexTitleOf;
}

function fail(message: string): never {
  throw new Error(message);
}

/** 全世代の周回を終えた後に呼ぶ。索引はここで作る */
export function lapSourcesOf<Elf, Lz>(
  ports: {
    catalogRowsOf: (
      generation: string,
      elf: Elf,
    ) => ReadonlyMap<number, CatalogRow>;
    elfOf: (generation: string) => Elf;
    indexGenerations: readonly string[];
  },
  songmaps: ReadonlyMap<string, SongmapDoc>,
  lzPlaces: ReadonlyMap<string, Lz>,
): LapSources<Elf, Lz> {
  const songmapOf = (generation: string) =>
    songmaps.get(generation) ??
      fail(`${generation}のsongmapが周回で作られていない`);
  const indexTitleOf = indexTitlesOf(ports.catalogRowsOf, ports.elfOf);
  return {
    elfOf: ports.elfOf,
    index: songIndexOf(ports.indexGenerations, songmapOf, indexTitleOf),
    indexTitleOf,
    lzOf: (generation) =>
      lzPlaces.get(generation) ??
        fail(`${generation}のLZファイルが周回で書かれていない`),
    songmapOf,
  };
}
