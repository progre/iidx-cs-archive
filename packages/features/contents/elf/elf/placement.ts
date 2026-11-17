// 加工ELFをDATA1追記の後ろへ移す再配置と、ISO9660ディレクトリレコードの書換え内容。
// A/B/Cは原盤の位置のまま読まれ、新規資産はABC表の絶対LBAで引くので再配置しない。

import { SEC } from "@csa/core";
import type { FileRelocation } from "./file_table.ts";

/** ELFはイメージの最後に置く。長さが決まってから位置が決まる */
export interface ElfPlacement {
  lba: number;
  sectors: number;
  /** PVDへ書くボリューム長。ELFの終端 */
  volumeSectors: number;
}

/** 配置計画のうち、再配置が読む欄 */
export interface PlacedPlan {
  totalSectors: number;
}

/** 原盤イメージのELFのディレクトリレコードのうち、再配置が読む欄 */
export interface ImageElfRecord {
  elf: { lba: number; recordOffset: number };
}

/** ELFのディレクトリレコードのextent・sizeの書き換え */
export interface ElfMetadataPatch {
  lba: number;
  recordOffset: number;
  size: number;
}

export function placeElf(plan: PlacedPlan, elfBytes: number): ElfPlacement {
  const sectors = Math.ceil(elfBytes / SEC);
  return {
    lba: plan.totalSectors,
    sectors,
    volumeSectors: plan.totalSectors + sectors,
  };
}

export function buildRelocations(
  image: ImageElfRecord,
  elf: ElfPlacement,
  elfName: string,
): FileRelocation[] {
  return [
    {
      fromLba: image.elf.lba,
      name: `\\${elfName};1`,
      sectors: elf.sectors,
      toLba: elf.lba,
    },
  ];
}

export function buildMetadata(
  image: ImageElfRecord,
  elf: ElfPlacement,
  elfBytes: number,
): ElfMetadataPatch[] {
  return [
    {
      lba: elf.lba,
      recordOffset: image.elf.recordOffset,
      size: elfBytes,
    },
  ];
}
