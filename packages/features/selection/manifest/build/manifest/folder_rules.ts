// 曲へ書く作品番号の規則を作る。入力は2つある。
// - 全曲リストの`folder`列
// - 各世代の曲DBから読んだ、曲ごとの作品番号と新旧の印
// 規則そのものは`folder/rules.ts`の`newFolderRules`が決める。原盤は開かない。

import type { CatalogRow } from "@csa/core";
import {
  type CarriedSong,
  folderCarry,
  folderOverrideKey,
  type FolderOverrides,
  type FolderRules,
  newFolderRules,
  oldSongKeys,
  songRows,
  songsByGeneration,
} from "../folder/mod.ts";
import type { ManifestBuildPorts, ManifestLaps } from "./ports.ts";

type Ports<Elf> = Pick<
  ManifestBuildPorts<Elf, unknown>,
  "catalogRowsOf" | "groupedCatalogs" | "tables"
>;

/**
 * 全世代の全曲リストから、`folder`列を書いた行を集める。
 * 行番号で引く指定と、行番号を持たない曲のために曲番号(その曲の1行目)で引く指定を作る
 */
function readOverrides<Elf>(
  { catalogRowsOf, groupedCatalogs, tables }: Ports<Elf>,
  generations: readonly string[],
  elfOf: (generation: string) => Elf,
): FolderOverrides {
  const overrides = new Map<string, number>();
  const set = (key: string, generation: string, row: CatalogRow) => {
    if (row.folder === null) {
      return;
    }
    try {
      overrides.set(key, tables.folderVersion(row.folder));
    } catch (error) {
      throw new Error(`${generation}の全曲リストのline ${row.line}`, {
        cause: error,
      });
    }
  };
  for (const generation of generations) {
    catalogRowsOf(generation, elfOf(generation)).forEach((row, songId) =>
      set(folderOverrideKey(generation, songId), generation, row)
    );
    groupedCatalogs()
      .find((catalog) => catalog.generation === generation)
      ?.rows.forEach((row) =>
        set(folderOverrideKey(generation, 0, row.line), generation, row)
      );
  }
  return overrides;
}

export function loadFolderRules<Elf>(
  ports: Ports<Elf>,
  { bytes, sources: { elfOf, index } }: Pick<
    ManifestLaps<Elf>,
    "bytes" | "sources"
  >,
): FolderRules {
  const allSongRows = (): CarriedSong[] =>
    songRows(songsByGeneration(index), bytes.versionAt, bytes.newOldAt);
  return newFolderRules(
    readOverrides(ports, index.generations, elfOf),
    ports.tables,
    (versionOf) => folderCarry(allSongRows(), versionOf),
    () =>
      oldSongKeys(
        "3rd",
        songsByGeneration(index),
        bytes.newOldAt,
        ports.tables.markedVersion,
      ),
  );
}
