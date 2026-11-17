// 原盤のイメージから、CSAが書き換えるファイルの位置と、ボリュームの大きさを読む。

import { SEC } from "@csa/core";
import { volumeSectorsOf } from "../volume/mod.ts";
import type { PbSource } from "./pb_source.ts";

export interface ImageFile {
  lba: number;
  recordOffset: number;
  size: number;
}

export interface ImageInfo {
  data1: ImageFile;
  elf: ImageFile;
  /** `MODULES/IOPRP310.IMG`。cdvdmanのセクタID照合を差し替える */
  iopModule: ImageFile;
  volumeSectors: number;
}

function required(
  files: ReadonlyMap<string, ImageFile>,
  name: string,
): ImageFile {
  const entry = files.get(name);
  if (!entry) throw new Error(`ISO9660に${name}が無い`);
  return {
    lba: entry.lba,
    recordOffset: entry.recordOffset,
    size: entry.size,
  };
}

export async function readImageInfo(
  pb: PbSource,
  elfName: string,
): Promise<ImageInfo> {
  const volumeSectors = volumeSectorsOf(await pb.readAt(16 * SEC, SEC));
  if (pb.info.size !== volumeSectors * SEC) {
    throw new Error(
      `PVD volume size ${volumeSectors * SEC} != image ${pb.info.size}`,
    );
  }
  const files = pb.info.files;
  return {
    data1: required(files, "DATA1.DAT"),
    elf: required(files, elfName.toUpperCase()),
    iopModule: required(files, "IOPRP310.IMG"),
    volumeSectors,
  };
}

/** 原盤のイメージからELFを読み出す。CSAのELFを作る元になる */
export function readSourceElf(
  pb: PbSource,
  elf: ImageFile,
): Promise<Uint8Array> {
  return pb.readAt(elf.lba * SEC, elf.size);
}
