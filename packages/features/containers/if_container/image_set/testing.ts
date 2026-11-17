// 画像セットのテストが使う、合成した画像セットの組み立て。原盤は読まない。

import type { IfPackage, IfSprite } from "@csa/core";
import { buildIfPackage, parseIfPackage } from "../format/mod.ts";
import { buildImageSetMetadata } from "./metadata.ts";
import { clutIndex, encodeTexture8, PALETTE_BYTES } from "../texture/mod.ts";
import { SHEET_WIDTH } from "./sprites/mod.ts";

export const SHEET_HEIGHT = 64;

/** 画像セットのmetadataの型紙である。animationの記録は、8バイトの0が1件だけ入る */
function metadataTemplate(): Uint8Array {
  const out = new Uint8Array(0x100);
  const view = new DataView(out.buffer);
  view.setUint16(4, 1, true);
  view.setUint32(8, 0xd0, true);
  view.setUint32(0x0c, 0xe8, true);
  view.setUint32(0xe8, 0xe0, true);
  return out;
}

/** 画素の値が指すパレットの位置へ色を置く */
export function paletteOf(colors: Map<number, number[]>): Uint8Array {
  const palette = new Uint8Array(PALETTE_BYTES);
  for (const [value, rgba] of colors) {
    palette.set(rgba, clutIndex(value) * 4);
  }
  return palette;
}

/**
 * 同じ寸法のシートを`sheetCount`枚並べた画像セットを作る。
 * `pixels`の画素の値は、先頭のシートの指定の位置から並べる。
 */
export function imageSetOf(
  sprites: IfSprite[],
  pixels: { x: number; y: number; values: number[] }[],
  palette: Uint8Array = new Uint8Array(PALETTE_BYTES),
  sheetCount = 1,
): IfPackage {
  const sheets = Array.from({ length: sheetCount }, () => {
    return new Uint8Array(SHEET_WIDTH * SHEET_HEIGHT);
  });
  for (const { x, y, values } of pixels) {
    sheets[0].set(values, y * SHEET_WIDTH + x);
  }
  const metadata = buildImageSetMetadata(
    metadataTemplate(),
    sheets.map(() => ({ height: SHEET_HEIGHT, width: SHEET_WIDTH })),
    sprites,
  );
  const textures = sheets.map((indices) =>
    encodeTexture8(indices, palette, SHEET_WIDTH, SHEET_HEIGHT)
  );
  return parseIfPackage(buildIfPackage([metadata, ...textures]));
}
