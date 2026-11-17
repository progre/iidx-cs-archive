// 曲DBを読み書きする処理と、それに近い判定の処理へ、世代の定義を渡す。

import { songmapOfGeneration as songmapOf } from "@csa/contents-file-table";
import {
  type LevelPorts,
  PbEntryFormat,
  SongDb,
  withBeginnerLimit as limit,
  withLevels as write,
} from "@csa/contents-song-db";
import { convertedFileOf, fitsAnyBuffer } from "@csa/contents-video";
import type { CatalogRow, ManifestSongDraft, SongmapDoc } from "@csa/core";
import {
  chartSlotsOf,
  elfDefinitionOf,
  songCountOf,
  songmapRuleOf,
} from "@csa/selection-definitions";
import { isOriginalVideoPlayable } from "@csa/selection-manifest";
import { levelsByDifficulty, levelsToWrite } from "@csa/selection-song-catalog";

export { convertedFileOf };

export const openSongDb = (generation: string, elf: Uint8Array): SongDb =>
  new SongDb(elf, elfDefinitionOf(generation));

/** PB形式の曲DBエントリの形。欄はPBの定義の配置と譜面の並びで読み書きする */
export const PB_ENTRY = new PbEntryFormat(
  elfDefinitionOf("pb"),
  chartSlotsOf("pb"),
);

export const songmapOfGeneration = (
  generation: string,
  elf: Uint8Array,
): SongmapDoc =>
  songmapOf(
    {
      definitionOf: elfDefinitionOf,
      openDb: (elf, def) => new SongDb(elf, def),
      ruleOf: songmapRuleOf,
      songCountOf,
    },
    generation,
    elf,
  );

export const levelPorts: LevelPorts = { levelsByDifficulty, levelsToWrite };

export const withLevels = (
  entryText: string,
  row: Pick<
    ManifestSongDraft,
    "catalogLevels" | "fiveKeyOf" | "sourceGeneration" | "sourceSongIndex"
  >,
  rows: Map<number, Pick<CatalogRow, "levels">>,
): string => write(levelPorts, PB_ENTRY, entryText, row, rows);

export const withBeginnerLimit = (entryText: string): string =>
  limit(PB_ENTRY, entryText);

/** 原作のムービーをそのまま置けるか */
export const isPlayable = (row: ManifestSongDraft): boolean =>
  isOriginalVideoPlayable(row, fitsAnyBuffer);
