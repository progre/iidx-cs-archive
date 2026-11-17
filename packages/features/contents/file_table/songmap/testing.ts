// songmapを作るテストの作り物。ELFと曲DBのレコードを、合成した値で組む。

import type { ElfDefinition } from "@csa/core";
import type { SongmapRecord } from "./types.ts";

/** 譜面の欄の並び。PBと同じ並びにする */
export const CHART_SLOTS = [
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

/** 行は12バイトで、先頭がセクター、2番目が大きさ */
export function elfOf(
  tables: { offset: number; sizes: number[] }[],
): Uint8Array {
  const elf = new Uint8Array(0x400);
  const view = new DataView(elf.buffer);
  tables.forEach(({ offset, sizes }) => {
    sizes.forEach((size, row) => {
      view.setUint32(offset + row * 12, row + 1, true);
      view.setUint32(offset + row * 12 + 4, size, true);
    });
  });
  return elf;
}

export function definitionOf(
  archives: { fileName: string; offset: number; count: number }[],
  options: { elfPointers: boolean; videoRule: "overlap" | null },
): ElfDefinition {
  const layout = {
    video: { archiveRule: options.videoRule, secondaryIsFallback: false },
    overlay: { archiveRule: options.videoRule },
    chart: { areElfPointers: options.elfPointers },
  };
  return {
    fileName: "ELF",
    pointerBase: 0x100,
    fileTable: { archives, rowBytes: 12, sizeIndex: 1, sizeUnit: 1 },
    songDbRecordLayout: layout,
  } as unknown as ElfDefinition;
}

export function recordOf(fields: {
  title: string;
  /** 埋め込みの枠の中身。省略するとtitleと同じ */
  embedded?: string;
  /** 曲DBの題名の欄が指す文字列。省略するとtitleと同じ */
  text?: string;
  levels?: number[];
  beginnerLevel?: number | null;
  video?: number[];
  charts?: number[];
  sounds?: number[];
  anotherBgm?: number | null;
  overlay?: number | null;
}): SongmapRecord {
  return {
    title: {
      fullIn: () => fields.title,
      embeddedIn: () => fields.embedded ?? fields.title,
      text: fields.text ?? fields.title,
    },
    selection: {
      levels: fields.levels ?? [0, 0],
      beginnerLevel: fields.beginnerLevel ?? null,
      origin: null,
    },
    video: {
      primary: fields.video ?? [0xffff],
      secondary: null,
      secondaryArchive: null,
    },
    chart: {
      files: fields.charts ?? [],
      sounds: fields.sounds ?? [0xffff, 0xffff, 0xffff, 0xffff],
      anotherBgm: fields.anotherBgm ?? null,
    },
    overlay: { file: fields.overlay ?? null },
  };
}
