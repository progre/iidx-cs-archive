// DATA1のTOC。ELF内に`{u32 id, u32 sector, u32 count, u32 0}`が並び、
// ファイル番号で引くとDATA1の先頭からのセクタ位置と長さが得られる。
// 位置は素材世代なら`DisplayLayout`が持ち、PBは加工前ELFの原盤TOCを使う。
// 同じ16バイトの行を書く側は`data1.ts`である。

/** PB原盤のTOC。vaddr `0x239900` − `0xFFF80` */
export const PB_TOC_FILE_OFFSET = 0x139980;
/** PB原盤のTOCの件数 */
export const PB_TOC_COUNT = 1469;

export interface Data1TocRow {
  /** 占めるセクタ数 */
  count: number;
  /** DATA1の先頭からのセクタ位置 */
  sector: number;
}

export function data1TocRow(
  elf: Uint8Array,
  tocFileOffset: number,
  index: number,
): Data1TocRow {
  const dv = new DataView(elf.buffer, elf.byteOffset, elf.byteLength);
  const off = tocFileOffset + index * 16;
  if (dv.getUint32(off, true) !== index) {
    throw new Error(`DATA1 TOC[${index}]のidが一致しない`);
  }
  return {
    count: dv.getUint32(off + 8, true),
    sector: dv.getUint32(off + 4, true),
  };
}
