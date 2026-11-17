// 曲リストの処理へ、他の feature の実装を渡す。

import { ifPayloadLength } from "@csa/containers-if-container";
import { chartPrintsReader, chartShapesReader } from "@csa/contents-chart";
import { displayLayout, SOURCE_DATA1_ARCHIVE } from "@csa/contents-display";
import {
  applyFiveKeyFields,
  data1TocRow,
  PB_TOC_FILE_OFFSET,
  pbVersion,
  pbVersionsOf,
  withPbVersion,
} from "@csa/contents-elf";
import {
  isLegacyOverlay,
  overlayLayout,
  readOverlay,
} from "@csa/contents-overlay";
import { legacyOverlayFilesOfElf } from "@csa/contents-file-table";
import {
  entryFolderOf,
  FALLBACK_VIDEO_ABC_INDEX,
  folderShort,
  listEntryOf,
  sourceFolderOf,
  versionByteOf,
  versionFolder,
} from "@csa/contents-song-db";
import { printOf, soundPrint } from "@csa/contents-sound";
import { contentLength, copyPathOf, readFileAt } from "@csa/contents-video";
import { abcIndexOfAsset, newAbcIndices } from "@csa/layout-iso-plan";
import type {
  FinishedManifest,
  ManifestSongDraft,
  OpenDisc,
  SongmapDoc,
  SoundPrint,
} from "@csa/core";
import {
  type LapMeasurePorts,
  measureLap as measure,
  type PbDisc,
  readPbSongs as readPb,
  type SongListLaps,
  type SongListOptions,
  type SongListRun,
  type SongListWritePorts,
  writeSongListFiles as write,
} from "@csa/report-song-list";
import {
  chartFormatOf,
  chartSlotsOf,
  elfDefinitionOf,
  GENERATIONS,
} from "@csa/selection-definitions";
import { DISCS_DIRECTORY } from "@csa/selection-manifest";
import {
  catalogKeyOf,
  parseMovieAliases,
  readMovieAliasesText,
} from "@csa/selection-song-catalog";
import type { LapSources } from "../../laps/mod.ts";
import { openSongDb, PB_ENTRY } from "./song_db.ts";

const lapPorts: LapMeasurePorts = {
  contentLength,
  dataArchive: SOURCE_DATA1_ARCHIVE,
  ifPayloadLength,
  isLegacyOverlay: (generation) => isLegacyOverlay(elfDefinitionOf(generation)),
  legacyOverlayFiles: (generation, elf) =>
    legacyOverlayFilesOfElf(
      openSongDb(generation, elf),
      elf,
      elfDefinitionOf(generation),
    ),
  overlayPackagesOf: (generation, elf, songId) =>
    readOverlay(
      overlayLayout(elfDefinitionOf(generation)),
      openSongDb(generation, elf).bytesOf(songId),
    ).packages,
  pbEntryOf: (elf, songId) => openSongDb("pb", elf).bytesOf(songId).slice(),
  pbOverlayOf: (entry) =>
    readOverlay(overlayLayout(elfDefinitionOf("pb")), entry),
  pbTocFileOffset: PB_TOC_FILE_OFFSET,
  printOf,
  soundPrint,
  sourceTocFileOffset: (generation) =>
    displayLayout(generation).data1TocFileOffset,
  tocRowOf: data1TocRow,
};

const writePorts: SongListWritePorts<LapSources> = {
  abcIndexOfAsset,
  applyFiveKeyFields: (song, frontEntry, ownLevels) =>
    applyFiveKeyFields(PB_ENTRY, song, frontEntry, ownLevels),
  catalogKeyOf,
  chartPrintsReader: (sources) => chartPrintsReader(chartFormatOf, sources),
  chartShapesReader: (sources) => chartShapesReader(chartFormatOf, sources),
  chartSlots: chartSlotsOf("pb"),
  contentLength,
  copyPathOf,
  decodeEntry: (entry) => PB_ENTRY.decode(entry),
  difficultyNameOfChartField: (fieldOffset) =>
    PB_ENTRY.difficultyNameOfChartField(fieldOffset),
  discsDirectory: DISCS_DIRECTORY,
  entryVideoAbcIndex: (entry) =>
    PB_ENTRY.recordOf(PB_ENTRY.decode(entry)).video.primary[0],
  fallbackVideoAbcIndex: FALLBACK_VIDEO_ABC_INDEX,
  folderShort,
  generations: GENERATIONS,
  listEntryOf: (entry) =>
    listEntryOf(PB_ENTRY, entry, entryFolderOf(PB_ENTRY, entry)),
  movieAliases: () => parseMovieAliases(readMovieAliasesText()),
  newAbcIndices,
  pbListEntryOf: (entry, songId, folders) =>
    listEntryOf(
      PB_ENTRY,
      entry,
      versionFolder(
        pbVersion(versionByteOf(PB_ENTRY.recordOf(entry)), songId, folders),
      ),
    ),
  pbVersionsOf,
  printOf,
  readFileAt,
  soundPrint,
  sourceFolderOf,
  versionFolder,
  withPbVersion: (entry, songId, folders) =>
    withPbVersion(PB_ENTRY, entry, songId, folders),
};

/**
 * `songIds`は、世代の各行の曲番号である。`songs`は、下書きの欄を埋めた行である。
 * `knownSoundPrints`にある音は、原盤から読まない
 */
export const measureLap = (
  opened: OpenDisc,
  generation: string,
  elf: Uint8Array,
  songIds: Iterable<number>,
  songs: readonly ManifestSongDraft[],
  knownSoundPrints: ReadonlyMap<string, SoundPrint>,
) =>
  measure(
    lapPorts,
    opened,
    generation,
    elf,
    songIds,
    songs,
    knownSoundPrints,
  );

/** PBの周回で、PB原盤の曲と、そのオーバーレイの長さとハッシュを読む */
export const readPbSongs = (
  elf: Uint8Array,
  songmap: SongmapDoc,
  disc: PbDisc,
) => readPb(lapPorts, elf, songmap, disc);

/** 曲リストを書き、素材を整えた結果を返す。`prepare`は、書く途中で素材を整える */
export const writeSongListFiles = <P extends { manifest: FinishedManifest }>(
  run: SongListRun,
  laps: SongListLaps<LapSources>,
  options: SongListOptions<P>,
): Promise<P> => write(writePorts, run, laps, options);
