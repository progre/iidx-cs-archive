// テスト用のPBの定義。`definitions.csv`のPBの列と同じ配置を、このパッケージの外を読まずに組む。

import type { ElfDefinition } from "@csa/core";
import { PbEntryFormat } from "./format/mod.ts";

export const PB_DEFINITION: ElfDefinition = {
  fileName: "PB.ELF",
  fileTable: { archives: [], rowBytes: 8, sizeIndex: 1, sizeUnit: 1 },
  pointerBase: 0,
  songDbBase: 0x100,
  songDbRecordCount: 4,
  songDbRecordLength: 0x134,
  songDbRecordLayout: {
    artwork: {
      artistOffset: null,
      bigTitleOffset: null,
      genreOffset: null,
      imageSet: { count: 4, offset: 0xac },
      titleCard: { bytes: 4, offset: 0x94 },
      titleCardPairs: { count: 5, offset: 0x98 },
      unkPbBcOffset: 0xbc,
    },
    chart: {
      areElfPointers: false,
      files: { count: 10, offset: 0xc0 },
      anotherBgmOffset: null,
      keysoundArchiveOffset: null,
      notes: { count: 15, offset: 0x108 },
      sounds: { count: 16, offset: 0xe8 },
      unkPb126: { count: 7, offset: 0x126 },
    },
    overlay: {
      archiveRule: null,
      fileOffset: null,
      packages: { count: 8, offset: 0x64 },
      pairs: { count: 8, offset: 0x74 },
      slots: null,
    },
    selection: {
      beginnerLevelOffset: null,
      bpm: { firstOffset: 0x46, maxOffset: 0x44, minOffset: 0x42 },
      levels: { count: 10, offset: 0x4a },
      origin: { bytes: 2, isVersion: true, offset: 0x54 },
      others: { bytes: 2, offset: 0x40 },
    },
    title: {
      encoding: null,
      fullOffset: null,
      hasIndexPrefix: false,
      isElfPointer: false,
      offset: 0,
    },
    video: {
      archiveRule: null,
      derivesSecondary: false,
      movieCountInOffset: null,
      movieLeadOffset: 0x60,
      primary: { bytes: 4, count: 2, offset: 0x58 },
      secondary: null,
      secondaryArchiveOffset: null,
      secondaryIsFallback: false,
      unkPb62Offset: 0x62,
    },
  },
};

/** テスト用の譜面の並び。`selection/definitions`のPBの並びと同じにする */
export const PB_CHART_SLOTS = [
  "sp_hyper",
  "dp_hyper",
  "sp_another",
  "dp_another",
  "sp_normal",
  "dp_normal",
  "sp_beginner",
  "dp_beginner",
  "sp_black",
  "dp_black",
];

export const PB_FORMAT = new PbEntryFormat(PB_DEFINITION, PB_CHART_SLOTS);
