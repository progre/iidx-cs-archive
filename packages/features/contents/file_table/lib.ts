export type { FileFieldsRecord } from "./archive_rule.ts";
export { type FileEntry, FileTable } from "./file_table.ts";
export {
  hasOverlayFileOf,
  type LegacyOverlayFile,
  legacyOverlayFilesOf,
  legacyOverlayFilesOfElf,
  overlayFileOf,
} from "./song_overlay.ts";
export {
  elfSegmentOf,
  segmentOf,
  type SongmapInput,
  songmapOf,
  songmapOfGeneration,
  type SongmapRecord,
  type SongmapRule,
  type VideoPlan,
} from "./songmap/mod.ts";
export {
  songVideoRecordsOf,
  songVideoRecordsOfElf,
  type VideoFile,
  videoFilesOf,
} from "./song_videos.ts";
