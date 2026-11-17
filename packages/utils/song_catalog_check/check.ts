// 全曲リストを原盤の曲DBと照合し、報告の行を返す。
// `removeSame`が真なら、原作と同じ難易度をリストから消す。

import {
  chartSlotsOf,
  type Definition,
  DEFINITIONS,
  levelChartsOf,
} from "@csa/selection-definitions";
import {
  CATALOG_DIRECTORY,
  catalogFileNames,
  catalogPathsOf,
  type DbContent,
  existingChartsOf,
  missingFileLine,
  originalLevelsOf,
  readCatalogText,
  removeSameLevels,
  reviewCatalog,
  strayFileLines,
  writeCatalogText,
} from "@csa/selection-song-catalog";
import { openGenerationIso, readDiscFolders } from "@csa/containers-disc";
import { SongDb } from "@csa/contents-song-db";
import { SEC } from "@csa/core";

// 原盤のELFから曲DBを読む。
export async function readOriginalDb(
  definition: Definition,
): Promise<DbContent> {
  const { generation, elf } = definition;
  using disc = await openGenerationIso(readDiscFolders(), generation);
  const files = await disc.collectFiles();
  const entry = files.get(elf.fileName.toUpperCase());
  if (entry == null) {
    throw new Error(`no ELF: ${generation}`);
  }
  const db = new SongDb(await disc.readAt(entry.lba * SEC, entry.size), elf);
  const records = Array.from({ length: db.length }, (_, id) => db.record(id));
  return {
    songs: records.map((record, songId) => ({
      songId,
      title: record.title.text,
    })),
    originals: new Map(records.map((record, songId) => [songId, {
      levels: originalLevelsOf(levelChartsOf(generation), record.selection),
      charts: existingChartsOf(chartSlotsOf(generation), record.chart.files),
    }])),
  };
}

async function checkGeneration(
  definition: Definition,
  paths: Map<string, string>,
  removeSame: boolean,
): Promise<string[]> {
  const { generation } = definition;
  const path = paths.get(generation);
  if (path == null) {
    return [missingFileLine(generation)];
  }
  const text = readCatalogText(path);
  const content = await readOriginalDb(definition);
  try {
    const { lines, levelReports } = reviewCatalog(generation, text, content);
    if (removeSame) {
      writeCatalogText(path, removeSameLevels(text, levelReports));
    }
    return lines;
  } catch (cause) {
    throw new Error(path, { cause });
  }
}

export async function checkSongCatalog(removeSame: boolean): Promise<string[]> {
  const paths = catalogPathsOf(CATALOG_DIRECTORY, catalogFileNames());
  const generations = DEFINITIONS.map((definition) => definition.generation);
  const reports = await Promise.all(
    DEFINITIONS.map((definition) =>
      checkGeneration(definition, paths, removeSame)
    ),
  );
  return strayFileLines(paths, generations).concat(reports.flat());
}
