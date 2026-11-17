// 画像セットのmetadata(file 0)を、sheetとspriteの表から組む。

import type { IfSheet, IfSprite } from "@csa/core";

/** metadataのsprite表は原盤の全画像セットで0xD0固定。sheet寸法は最大48件収まる */
const SPRITE_TABLE_OFFSET = 0xd0;

/**
 * sheet表(`+0x10`から4バイト×sheet数)が0xD0に収まらないときだけsprite表を後ろへ送る。
 * 読み側はこの位置をヘッダー`+8`から取る。分割前の中間パッケージが48 sheetを超えるため
 * に要る仕掛けで、ローダーへ渡す分割後のファイルは32 sheet以下なので0xD0のままになる。
 */
const spriteTableOffsetOf = (sheetCount: number) =>
  Math.max(SPRITE_TABLE_OFFSET, (0x10 + sheetCount * 4 + 15) & ~15);

/**
 * 画像セットのmetadataを組む。animationは元metadataの記録をそのまま写す。
 * 原盤の画像セットは全て、metadata扉のframe1件だけを持ちspriteを参照しない。
 */
export function buildImageSetMetadata(
  original: Uint8Array,
  sheets: IfSheet[],
  sprites: IfSprite[],
): Uint8Array {
  const src = new DataView(
    original.buffer,
    original.byteOffset,
    original.byteLength,
  );
  const animTable = src.getUint32(0x0c, true);
  const anim0 = src.getUint32(animTable, true);
  if (
    src.getUint16(4, true) !== 1 ||
    src.getUint32(8, true) < spriteTableOffsetOf(src.getUint16(2, true))
  ) {
    throw new Error("元metadataが画像セット形式でない");
  }
  return imageSetMetadataOf(
    {
      animation: original.subarray(anim0, animTable),
      head: src.getUint16(0, true),
    },
    sheets,
    sprites,
  );
}

/** 画像セットのmetadataのうち、sheetとspriteで決まらない部分 */
export interface ImageSetMetadataParts {
  /** animation 0 の項目から、animation表の手前まで */
  animation: Uint8Array;
  /** 先頭のu16 */
  head: number;
}

/** sheetとspriteの表に、animationの1件を付けてmetadataを組む */
export function imageSetMetadataOf(
  { animation: blob, head }: ImageSetMetadataParts,
  sheets: IfSheet[],
  sprites: IfSprite[],
): Uint8Array {
  const spriteTable = spriteTableOffsetOf(sheets.length);
  const newAnim0 = (spriteTable + sprites.length * 8 + 15) & ~15;
  const newAnimTable = newAnim0 + blob.length;
  const out = new Uint8Array((newAnimTable + 4 + 15) & ~15);
  const dv = new DataView(out.buffer);
  dv.setUint16(0, head, true);
  dv.setUint16(2, sheets.length, true);
  dv.setUint16(4, 1, true);
  dv.setUint16(6, sprites.length, true);
  dv.setUint32(8, spriteTable, true);
  dv.setUint32(12, newAnimTable, true);
  sheets.forEach((sheet, i) => {
    dv.setUint16(0x10 + i * 4, sheet.width, true);
    dv.setUint16(0x10 + i * 4 + 2, sheet.height, true);
  });
  sprites.forEach((sprite, i) => {
    const off = spriteTable + i * 8;
    dv.setUint16(off, sprite.x, true);
    dv.setUint16(off + 2, sprite.y, true);
    dv.setUint16(off + 4, sprite.w, true);
    dv.setUint16(off + 6, sprite.h, true);
  });
  out.set(blob, newAnim0);
  dv.setUint32(newAnimTable, newAnim0, true);
  return out;
}
