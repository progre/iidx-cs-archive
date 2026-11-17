// 曲の下書きの処理へ、世代の決まりと selection・display の処理を渡す。

import {
  type DraftOverlayPorts,
  type LegacyOverlaySource,
  overlayOf,
  sourceOverlayOf,
  titleCardOf,
} from "@csa/contents-display";
import { data1TocRow } from "@csa/contents-elf";
import {
  isLegacyOverlay,
  overlayLayout,
  PB_OVERLAY_PAIR_COUNT,
  readOverlay,
  sheetOverlayFieldsOf,
} from "@csa/contents-overlay";
import {
  draftManifestSong as draft,
  type DraftPorts,
  type EntryFolderRules,
  excludedSongs as excluded,
  finishManifestSong as finish,
  type LoadedSource as Loaded,
} from "@csa/contents-song-db";
import { needsLargeBuffer } from "@csa/contents-video";
import type { CatalogRow, ManifestSongDraft, ManifestSource } from "@csa/core";
import {
  elfDefinitionOf,
  elfFileNameOf,
  songDbPath,
} from "@csa/selection-definitions";
import {
  adoptedVideosOf,
  copiedAssets,
  legacyOverlayOf,
  requirePlayable,
  sheetOverlayOf,
  songmapSongOf,
  synthesizedAssets,
  titleCardOf as manifestTitleCard,
} from "@csa/selection-manifest";
import { legacyOverlayFiles, openLegacyOverlay } from "./sources.ts";
import {
  convertedFileOf,
  isPlayable,
  levelPorts,
  openSongDb,
  PB_ENTRY,
} from "./song_db.ts";

/** 周回の中だけで使う素材 */
export type LoadedSource = Loaded<LegacyOverlaySource>;

/** manifestに書く素材の項目。実行ファイルは読まない。songmapの名前は世代と同じである */
export const sourceManifestOf = (generation: string): ManifestSource => ({
  elf: elfFileNameOf(generation),
  entryRanges: PB_ENTRY.entryRangesOf(songDbPath(generation) === "copy"),
  songmap: generation,
});

/** 周回で読んだ実行ファイルとsongmapから、世代の素材を作る */
export const lapSourceOf = (
  generation: string,
  { elf, songmap, statsOf }: Pick<LoadedSource, "elf" | "songmap" | "statsOf">,
): LoadedSource => ({
  elf,
  manifest: sourceManifestOf(generation),
  copied: songDbPath(generation) === "copy",
  generation,
  legacy: isLegacyOverlay(elfDefinitionOf(generation))
    ? {
      filesOf: legacyOverlayFiles(generation, elf),
      slots: openLegacyOverlay(generation, elf),
    }
    : null,
  songmap,
  statsOf,
});

const overlayPorts: DraftOverlayPorts = {
  artworkOf: (generation) =>
    elfDefinitionOf(generation).songDbRecordLayout.artwork,
  bpmOfEntry: (entry) => PB_ENTRY.recordOf(entry).selection.bpm,
  entryBytesOf: (generation, elf, songId) =>
    openSongDb(generation, elf).bytesOf(songId),
  entryOffsetOf: (generation, elf, songId) =>
    openSongDb(generation, elf).offsetOf(songId),
  isLegacyOverlay: (generation) => isLegacyOverlay(elfDefinitionOf(generation)),
  legacyOverlayOf,
  readSongOverlay: (generation, entry) =>
    readOverlay(overlayLayout(elfDefinitionOf(generation)), entry),
  sheetFieldsOf: (generation, elf, entryOffset) =>
    sheetOverlayFieldsOf(elfDefinitionOf(generation), elf, entryOffset),
  sheetOverlayOf: (label, fields, toc) =>
    sheetOverlayOf(label, fields, toc, PB_OVERLAY_PAIR_COUNT),
  titleCardOf: manifestTitleCard,
  tocRowOf: data1TocRow,
};

const ports: DraftPorts<LegacyOverlaySource> = {
  adoptedVideosOf: (row) => adoptedVideosOf(row, needsLargeBuffer),
  copiedAssets,
  definitionOf: elfDefinitionOf,
  format: PB_ENTRY,
  isPlayable,
  levels: levelPorts,
  overlayOf: (row, source, entry) =>
    overlayOf(overlayPorts, row, source, entry),
  requirePlayable,
  songDbPathOf: songDbPath,
  songmapSongOf,
  sourceOverlayOf: (row, source) => sourceOverlayOf(overlayPorts, row, source),
  synthesizedAssets: (row, references) =>
    synthesizedAssets(row, references, convertedFileOf),
  titleCardOf: (row, source) => titleCardOf(overlayPorts, row, source),
};

export const draftManifestSong = (
  row: ManifestSongDraft,
  source: LoadedSource,
) => draft(ports, row, source);

export const finishManifestSong = (
  song: ManifestSongDraft,
  catalogRows: Map<number, Pick<CatalogRow, "levels">>,
  folders: EntryFolderRules,
  pbSongmap: Parameters<typeof finish>[4],
) => finish(ports, song, catalogRows, folders, pbSongmap);

export const excludedSongs = (
  songs: readonly ManifestSongDraft[],
  catalogRows: ReadonlyMap<string, Map<number, CatalogRow>>,
  folders: EntryFolderRules,
) => excluded(ports, songs, catalogRows, folders);
