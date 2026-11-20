// manifestと曲の行を作る処理へ、曲DBの読み書きと世代の決まりと全曲リストを渡す。

import { type Disc, readSegment } from "@csa/containers-disc";
import { pbVersion } from "@csa/contents-elf";
import {
  FALLBACK_VIDEO_ABC_INDEX,
  levelOfEntry,
  markedVersion,
  redirectEntryVideo,
  sourceVersionToCsa,
  titleOfEntry,
  unmarkedVersion,
  versionOfFolderName,
  videoFlagsOfEntry,
  withEntryTitle,
} from "@csa/contents-song-db";
import { needsLargeBuffer, videoProbesOf } from "@csa/contents-video";
import type { ExcludedSong, ManifestSongDraft, SongmapDoc } from "@csa/core";
import {
  chartSlotsOf,
  type Era,
  eraOf,
  fiveKeyOf,
  GENERATIONS,
  PB_GENERATION,
} from "@csa/selection-definitions";
import {
  type LapRows,
  lapRowsOf as lapRows,
  makeManifest as make,
  type ManifestBuildPorts,
} from "@csa/selection-manifest";
import {
  catalogKeyOf,
  difficultyNamesOf,
  levelsByDifficulty,
  readAnotherSwitches,
  readMovieAliases,
  readSharedAssets,
} from "@csa/selection-song-catalog";
import type { Era1Job } from "@csa/selection-video-era1";
import type { LapSongs } from "../../laps/mod.ts";
import {
  catalogCopiesOf,
  catalogRowAt,
  catalogRowsOf,
  groupedCatalogs,
  saveSlots,
} from "./sources.ts";
import {
  excludedSongs,
  finishManifestSong,
  sourceManifestOf,
} from "./draft.ts";
import { convertedFileOf, isPlayable, PB_ENTRY } from "./song_db.ts";

const ports: ManifestBuildPorts<Uint8Array, ExcludedSong> = {
  adoption: {
    convertedFileOf,
    needsLargeBuffer,
    redirectVideo: (entry, flags, fields, abcIndex) =>
      redirectEntryVideo(PB_ENTRY, entry, flags, fields, abcIndex),
    videoFieldOffset: (slot) => PB_ENTRY.videoFieldOffset(slot),
    videoFlagsOfEntry: (entry) => videoFlagsOfEntry(PB_ENTRY, entry),
  },
  catalogRowAt,
  catalogRowsOf,
  chartSlots: chartSlotsOf("pb"),
  // 3rd〜8th(era1)のムービーは、CSAが240x240へ変換する
  convertsVideo: (generation) => eraOf(generation) === "era1",
  excludedSongs,
  fallbackVideoAbcIndex: FALLBACK_VIDEO_ABC_INDEX,
  finishManifestSong,
  generations: GENERATIONS,
  groupedCatalogs,
  isPlayable,
  levelOf: (entry, name) => levelOfEntry(PB_ENTRY, entry, name),
  levelsByDifficulty,
  movieAliases: readMovieAliases,
  pbGeneration: PB_GENERATION,
  // 全曲リストを読むのは、manifest を作るときにする
  saveSlots: {
    get count() {
      return saveSlots().count;
    },
    indexOf: (generation, line) =>
      saveSlots().indexOf.get(catalogKeyOf(generation, 0, line)),
  },
  // 3rd〜8thで画面いっぱいの320x224のムービーを作ったのは6thだけで、変換しても画質が良い
  preferredConvertedVideoGeneration: "6th",
  sourceManifestOf,
  tables: {
    folderVersion: versionOfFolderName,
    markedVersion,
    pbVersion,
    sourceVersionToCsa,
    unmarkedVersion,
  },
  titleOf: (entry) => titleOfEntry(PB_ENTRY, entry),
  withTitle: (entry, title) => withEntryTitle(PB_ENTRY, entry, title),
};

export const makeManifest = (
  songs: readonly ManifestSongDraft[],
  lapSongs: LapSongs,
) => make(ports, songs, lapSongs);

export const lapRowsOf = (
  generation: string,
  era: Era,
  source: { elf: Uint8Array; songmap: SongmapDoc },
  opened: Disc,
  era1Jobs: readonly Era1Job[],
): Promise<LapRows> =>
  lapRows(
    {
      anotherSwitchRows: readAnotherSwitches,
      catalogCopiesOf,
      catalogRowsOf,
      difficultyNamesOf,
      fiveKeyOf,
      sharedAssetRows: readSharedAssets,
    },
    generation,
    era,
    source,
    videoProbesOf(generation, (file) => readSegment(opened, file)),
    era1Jobs,
  );
