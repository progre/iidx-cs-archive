// 世代の周回で、全曲リストと曲DBから曲の行を作る。
// 全曲リストで書いた組は、周回の後に結ぶ。

import type {
  AnotherSwitchRow,
  CatalogRow,
  ManifestSongDraft,
  SharedAssetRow,
  SongmapDoc,
} from "@csa/core";
import { type Era, groupEra1Jobs } from "../assets/mod.ts";
import {
  anotherSwitchesOf,
  type ListingPorts,
  listingsOf,
  sharesOf,
} from "../catalog/mod.ts";
import { indexKeyOf } from "../../index/mod.ts";
import { buildGeneration, type VideoProbes } from "./build_generation.ts";

/** `Elf`は世代の曲DBを持つ実行ファイルである。中身は全曲リストの処理だけが読む */
export interface LapRowsPorts<Elf> extends ListingPorts {
  anotherSwitchRows: () => AnotherSwitchRow[];
  catalogCopiesOf: (generation: string, elf: Elf) => Map<number, CatalogRow[]>;
  catalogRowsOf: (generation: string, elf: Elf) => Map<number, CatalogRow>;
  sharedAssetRows: () => SharedAssetRow[];
}

export interface LapRows {
  /** 曲番号から全曲リストの行を引く表 */
  catalogRows: Map<number, CatalogRow>;
  rows: ManifestSongDraft[];
}

export async function lapRowsOf<Elf>(
  ports: LapRowsPorts<Elf>,
  generation: string,
  era: Era,
  { elf, songmap }: { elf: Elf; songmap: SongmapDoc },
  probes: VideoProbes,
  era1Jobs: Parameters<typeof groupEra1Jobs>[0],
): Promise<LapRows> {
  console.time(`time ${generation} table rows`);
  const catalogRows = ports.catalogRowsOf(generation, elf);
  const copies = ports.catalogCopiesOf(generation, elf);
  const shares = sharesOf(generation, catalogRows, ports.sharedAssetRows());
  const anothers = anotherSwitchesOf(
    generation,
    catalogRows,
    ports.anotherSwitchRows(),
  );
  const rows = await buildGeneration(
    generation,
    era,
    songmap,
    probes,
    (song) =>
      indexKeyOf(
        generation,
        song,
        (_, songId) => catalogRows.get(songId)?.indexTitle ?? null,
      ),
    listingsOf(
      ports,
      generation,
      (songId) => [catalogRows.get(songId), ...copies.get(songId) ?? []],
      shares,
      anothers,
    ),
    groupEra1Jobs(era1Jobs).get(generation) ?? new Map(),
  );
  console.timeEnd(`time ${generation} table rows`);
  return { catalogRows, rows };
}
