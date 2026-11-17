// 共有画像セット .if をDATA1から読む。
// PBは加工前ELFの原盤TOC(0x239900)、素材世代は抽出元ELFのTOCを使う。

import { type DescriptorStart, type IfPackage, SEC } from "@csa/core";
import { normalizeIfDescriptors, parseIfPackage } from "../format/mod.ts";

/** 原盤のバイト列を位置で読む口。PBの原盤も素材世代の原盤も満たす */
export interface ByteReader {
  readAt(offset: number, length: number): Promise<Uint8Array>;
}

/** DATA1のTOCの1行を読む。`contents/elf`の`data1TocRow`を受ける */
export type TocRowOf = (
  elf: Uint8Array,
  tocFileOffset: number,
  index: number,
) => { count: number; sector: number };

export interface Data1Reader {
  data1Lba: number;
  descriptorStart: DescriptorStart;
  elf: Uint8Array;
  disc: ByteReader;
  tocFileOffset: number;
  tocRowOf: TocRowOf;
}

export async function readImageSet(
  reader: Data1Reader,
  index: number,
): Promise<IfPackage> {
  const row = reader.tocRowOf(reader.elf, reader.tocFileOffset, index);
  const bytes = await reader.disc.readAt(
    (reader.data1Lba + row.sector) * SEC,
    row.count * SEC,
  );
  return parseIfPackage(normalizeIfDescriptors(bytes, reader.descriptorStart));
}

export function pbReader(
  toc: { fileOffset: number; rowOf: TocRowOf },
  disc: ByteReader,
  data1Lba: number,
  pbElf: Uint8Array,
): Data1Reader {
  return {
    data1Lba,
    descriptorStart: 8,
    elf: pbElf,
    disc,
    tocFileOffset: toc.fileOffset,
    tocRowOf: toc.rowOf,
  };
}

export function sourceReader(
  tocRowOf: TocRowOf,
  disc: ByteReader,
  data1Lba: number,
  sourceElf: Uint8Array,
  layout: { data1TocFileOffset: number; descriptorStart: DescriptorStart },
): Data1Reader {
  return {
    data1Lba,
    descriptorStart: layout.descriptorStart,
    elf: sourceElf,
    disc,
    tocFileOffset: layout.data1TocFileOffset,
    tocRowOf,
  };
}
