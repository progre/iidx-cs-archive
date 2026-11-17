// era1ムービーの変換と形式の表へ、`@csa/selection-video-era1`の決まりを渡す。

import type { Disc } from "@csa/containers-disc";
import {
  convertEra1Generation as convert,
  type Era1ConvertPlaces,
  loadFormats as load,
  videoReaderOf,
} from "@csa/contents-video";
import { songVideoRecordsOfElf } from "@csa/contents-file-table";
import { SongDb } from "@csa/contents-song-db";
import { elfDefinitionOf } from "@csa/selection-definitions";
import {
  buildEra1Source,
  checkConvertedReport,
  cropFilter,
  ENCODE_ARGS,
  type Era1Job,
  type Era1Source,
  findProblems,
  formatKeyOf,
  formatOf,
  labelOf,
  metaTextOf,
  outputPathOf,
  reportLineOf,
} from "@csa/selection-video-era1";

export type { Era1ConvertPlaces };

/** 1世代のムービーを変換する。`disc`は周回で開いたISO */
export function convertEra1Generation(
  jobs: readonly Era1Job[],
  disc: Disc,
  places: Era1ConvertPlaces,
): Promise<void> {
  const read = videoReaderOf(disc);
  return convert(jobs, {
    checkReport: checkConvertedReport,
    encodeArgs: ENCODE_ARGS,
    filterOf: (job) => cropFilter(job.crop),
    findProblems,
    labelOf,
    metaTextOf,
    outputPathOf,
    read: (job) => read(job.video, job.video.size),
    reportLineOf,
  }, places);
}

/** 作品とファイルの組ごとの、解像度と多重化レートの表 */
export function loadFormats(
  generation: string,
  { videos }: Era1Source,
  disc: Disc,
): Promise<Map<string, string>> {
  return load(generation, videos, {
    formatKeyOf,
    formatOf,
    read: videoReaderOf(disc),
  });
}

/** 世代のELFから、曲が参照するムービーを列挙する */
export function loadEra1Source(
  generation: string,
  elf: Uint8Array,
): Era1Source {
  const definition = elfDefinitionOf(generation);
  return buildEra1Source(
    generation,
    songVideoRecordsOfElf(new SongDb(elf, definition), elf, definition),
  );
}
