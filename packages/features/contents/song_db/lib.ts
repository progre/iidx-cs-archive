/// 曲DBの形式を扱う。原盤のELFにある曲DBのレコードを読み書きし、PBの曲DBエントリを組む

export {
  difficultyOf,
  FALLBACK_VIDEO_ABC_INDEX,
  PbEntryFormat,
} from "./pb/format/mod.ts";
export {
  clearChartFields,
  entryFolderOf,
  levelFieldsWith,
  limitBeginnerLevel,
  listEntryOf,
  readFileFields,
  redirectEntryVideo,
  type SoundFieldWrite,
  withoutChartFields,
  writeDifficultyLevels,
  writeEntryVersion,
  writeSoundFields,
} from "./pb/mod.ts";
export {
  levelOfEntry,
  titleOfEntry,
  videoFlagsOfEntry,
  withEntryTitle,
} from "./manifest/entry/mod.ts";
export {
  type DraftBody,
  type DraftedSong,
  draftManifestSong,
  type DraftPorts,
  type EntryFolderRules,
  excludedSongs,
  finishManifestSong,
  LapSongBytes,
  type LoadedSource,
} from "./draft/mod.ts";
export {
  type LevelPorts,
  uncorrectedOf,
  withBeginnerLimit,
  withLevels,
  withoutCharts,
} from "./manifest/mod.ts";
export { SongDbRecord } from "./record/mod.ts";
export { SongDb } from "./song_db.ts";
export { synthesizeEntry } from "./synthesis/mod.ts";
export {
  folderShort,
  markedVersion,
  newOldLabel,
  sourceFolderOf,
  sourceVersionToCsa,
  unmarkedVersion,
  versionByteOf,
  versionFolder,
  versionOfFolderName,
} from "./version/mod.ts";
