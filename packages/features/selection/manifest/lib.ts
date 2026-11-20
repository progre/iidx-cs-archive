// 原盤から読んだ曲を、CSA の曲の記録(manifest)へ組む規則。
// 原盤の読み方と、ファイルを読む手段は、app から渡す。
export {
  makeManifest,
  type ManifestBuildPorts,
  type ManifestLaps,
} from "./build/manifest/mod.ts";
export type {
  AdoptionPorts,
  AdoptionSources,
  AliasAdoption,
  SongId,
  VideoAdoption,
} from "./build/adoption/mod.ts";
export {
  adoptionsOf,
  adoptVideos,
  redirectPbVideos,
} from "./build/video_adoption/mod.ts";
export { manifestReportLines } from "./build/mod.ts";
export {
  type ByteReader,
  type CarriedSong,
  folderCarry,
  folderOverrideKey,
  type FolderOverrides,
  type FolderRules,
  newFolderRules,
  oldSongKeys,
  songRows,
  songsByGeneration,
  type VersionTables,
} from "./build/folder/mod.ts";
export {
  assembleManifest,
  manifestOrderOfGeneration,
  plannedSongs,
  rowKey,
  selectSongs,
  songKey,
  targetSongCountOf,
} from "./build/rows/mod.ts";
export {
  type AnotherSwitches,
  DISCS_DIRECTORY,
  type Era,
  type Era1VideoJob,
  groupEra1Jobs,
  KIND_ORDER,
  type SourceFile,
} from "./candidates/assets/mod.ts";
export {
  assertSameKeysoundBank,
  era1ChartTargets,
  listing,
  songmapSong,
  sourceFile,
} from "./candidates/mod.ts";
export {
  draftedLapRows,
  type FrontMaterial,
  type FrontRulePorts,
  type LapRows,
  lapRowsOf,
  type LapRowsPorts,
  movieKeyOf,
  ruleFrontChooser,
  withOtherGenerationRows,
} from "./candidates/lap/mod.ts";
export {
  assembleSongRows,
  assertChartExclusions,
  assertPairsIncluded,
  assertShares,
  buildableSongs,
  buildGenerationRows,
  type Listing,
} from "./candidates/rows/mod.ts";
export {
  buildSongIndex,
  type IndexDoc,
  type IndexGenerationEntry,
  indexKeyOf,
  type IndexSongEntry,
  type IndexTitleOf,
  indexTitlesOf,
  type LapSources,
  lapSourcesOf,
  songIndexOf,
  titleKeyOf,
} from "./index/mod.ts";
export {
  forCurrentGeneration,
  indicesByGeneration,
  mapByGeneration,
} from "./by_generation.ts";
export {
  adoptedVideosOf,
  assetSource,
  type ConvertedFile,
  copiedAssets,
  type EntryFileReferences,
  isOriginalVideoPlayable,
  manifestAssetsOf,
  requirePlayable,
  type SongmapFileSlice,
  songmapSongOf,
  synthesizedAssets,
} from "./song/mod.ts";
export {
  type Data1Toc,
  legacyOverlayOf,
  sheetOverlayOf,
  titleCardOf,
} from "./song/display/mod.ts";
export { chartedSongs, type ChartPorts } from "./build/charts/mod.ts";
export {
  type SortTitlePorts,
  withSortTitles,
} from "./build/sort_titles/mod.ts";
export {
  anotherSwitchesOf,
  assertNoPbExclusion,
  type LapPbBack,
  type ListingPorts,
  listingsOf,
  pbBacksOf,
  pbSlotFilter,
  sharesOf,
  withCatalogFiveKeys,
  withCatalogVariants,
  withPbSlotFronts,
} from "./candidates/catalog/mod.ts";
