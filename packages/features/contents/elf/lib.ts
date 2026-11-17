/**
 * 原盤のELFと収録内容からCSAのELFを作る。
 */

// ELFの読み書き・MIPSの命令語・収録内容の型は、パッケージの外からも使う土台なので丸ごと出す
export * from "./elf/mod.ts";
export * from "./code/mips/mod.ts";
export * from "./code/iop_module/mod.ts";
export * from "./model/mod.ts";
export { buildCsaElf, verifyCsaElf } from "./build.ts";
export {
  type CsaElfInputSource,
  type CsaElfPorts,
  ubElfInput,
} from "./elf_input.ts";
export { DEFAULT_RECORDS, PB_SONG_COUNT, songCapacity } from "./model/mod.ts";
export {
  applyFiveKeyFields,
  data1TocRow,
  type FiveKeyFieldsSource,
  legacyTagOf,
  OFFSET_MASK,
  PB_TOC_COUNT,
  PB_TOC_FILE_OFFSET,
  pbVersion,
  pbVersionsOf,
  TAG_ABSOLUTE,
  TAG_SHIFT,
  withPbVersion,
} from "./data/content/mod.ts";
export {
  GUARD_DATA,
  GUARD_MARK,
  RAM_END,
  STACK_BASE,
} from "./code/heap/mod.ts";
export {
  buildSaveLayoutPatches,
  buildUnlockList,
  type Coordinate,
  FIXED_REGIONS,
  locate,
  makeSaveLayout,
  regionSize,
  SAVE_LAYOUT_ACTION,
  type SaveDataReference,
  SONG_REGIONS,
  type UnlockList,
} from "./code/instructions/save/mod.ts";
export {
  buildSongIndexLbuPatches,
  buildSongIndexSext32Patches,
  DSRL32_ACTION,
  LBU_ACTION,
} from "./code/instructions/song_index/mod.ts";
export {
  buildSongValueWidth,
  type SiteKind,
  SONG_VALUE_WIDTH_ACTION,
  type SongValueInput,
  type SongValueSite,
  type SongValueWidth,
} from "./code/instructions/song_value/mod.ts";
export {
  EXTRA_BASE,
  STUB_ALLOCATION,
  STUB_BASE,
  STUB_CAPACITY,
} from "./data/stub_area/mod.ts";
export {
  parseAddressTable,
  parseSaveDataReferences,
  parseSelectorWorkDirect,
  parseSongValueSites,
  readElfPatchTables,
} from "./code/instructions/tables/mod.ts";
export {
  PB_ABC_COUNT,
  PB_DATA1_COUNT,
  SONG_DB_BASE_PAIR,
} from "./data/segment/mod.ts";
export {
  addedFolderStart,
  buildAppendPatches,
  buildSelectorWorkPatches,
  E_APPEND_ACTION,
  makeAppendLayout,
  type SelectorWorkPatches,
  verifyAppendLayout,
  type WorkLayout,
} from "./code/selector_work/mod.ts";
export {
  PB_STACK_FRAME,
  STACK_RECORD_START,
  stackFrameFor,
} from "./code/selector_work/patch/mod.ts";
export { recordSizeCandidates } from "./code/selector_work/rewrite/mod.ts";
export {
  fileSourceElfPorts,
  type SourceElfPorts,
  SourceElfStore,
} from "./source/mod.ts";
