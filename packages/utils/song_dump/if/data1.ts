// 原盤のELFにあるDATA1 TOCから、DATA1の`.if`の区間を引く。

import { type DescriptorStart, SEC } from "@csa/core";
import {
  displayLayout,
  hasDisplayAssets,
  SOURCE_DATA1_ARCHIVE,
} from "@csa/contents-display";
import {
  data1TocRow,
  PB_TOC_COUNT,
  PB_TOC_FILE_OFFSET,
} from "@csa/contents-elf";
import type { FileEntry } from "@csa/contents-file-table";

export interface Data1Toc {
  count: number;
  /** `.if`の記述子の位置。9th〜redとUSは4で、展開の前に8へ並べ替える */
  descriptorStart: DescriptorStart;
  fileOffset: number;
}

/** DATA1を持たない3rd〜8thはnull */
export function data1TocOf(generation: string): Data1Toc | null {
  if (generation === "pb") {
    return {
      count: PB_TOC_COUNT,
      descriptorStart: 8,
      fileOffset: PB_TOC_FILE_OFFSET,
    };
  }
  if (!hasDisplayAssets(generation)) {
    return null;
  }
  const layout = displayLayout(generation);
  return {
    count: layout.data1TocCount,
    descriptorStart: layout.descriptorStart,
    fileOffset: layout.data1TocFileOffset,
  };
}

/** 区間はTOCのセクタ数ぶんで、圧縮データの後ろのゼロ埋めを含む */
export function data1EntryOf(
  elf: Uint8Array,
  toc: Data1Toc,
  index: number,
): FileEntry {
  if (!Number.isInteger(index) || index <= 0 || index >= toc.count) {
    throw new RangeError(`DATA1 TOCの範囲外: ${index} / ${toc.count}`);
  }
  const row = data1TocRow(elf, toc.fileOffset, index);
  return {
    archive: SOURCE_DATA1_ARCHIVE.toUpperCase(),
    index,
    offset: row.sector * SEC,
    size: row.count * SEC,
  };
}
