// テスト専用。必要なaddress範囲だけを持つ最小限のELFバッファを組み立てる。

import { MutableElf } from "./elf.ts";

const EHDR_SIZE = 0x34;
const PHDR_SIZE = 0x20;
const PT_LOAD = 1;

export interface FakeRegion {
  size: number;
  vaddr: number;
}

/** 各領域を個別のPT_LOADとして持つ、書き込みテスト用のELF */
export function buildFakeElf(regions: readonly FakeRegion[]): MutableElf {
  const headerSize = EHDR_SIZE + PHDR_SIZE * regions.length;
  let fileOffset = headerSize;
  const placed = regions.map((region) => {
    const offset = fileOffset;
    fileOffset += region.size;
    return { ...region, offset };
  });
  const bytes = new Uint8Array(fileOffset);
  const dv = new DataView(bytes.buffer);
  bytes.set([0x7f, 0x45, 0x4c, 0x46], 0);
  dv.setUint32(0x1c, EHDR_SIZE, true);
  dv.setUint16(0x2a, PHDR_SIZE, true);
  dv.setUint16(0x2c, placed.length, true);
  placed.forEach((region, index) => {
    const at = EHDR_SIZE + index * PHDR_SIZE;
    dv.setUint32(at + 0, PT_LOAD, true);
    dv.setUint32(at + 4, region.offset, true);
    dv.setUint32(at + 8, region.vaddr, true);
    dv.setUint32(at + 16, region.size, true);
  });
  return new MutableElf(bytes);
}
