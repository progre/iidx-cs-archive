// 素材の画像セットから、足すspriteだけを取り出す。
// 取り出したspriteは、画素と、そのspriteがあるシートのパレットだけを持つ。
// 画像セット全体を保持せずに、`mergeExtractedSprites`で足せる。

import type { IfPackage, IfSprite } from "@csa/core";
import { decodeIndices8 } from "../../texture/mod.ts";

/** 複数シートを1枚に見立てるときのシート間隔。spriteのyは、シート番号×この値を含む */
export const SHEET_STRIDE = 1024;

export interface ExtractedSprite {
  /** 素材の画像セットでのsprite番号 */
  index: number;
  /** 素材の画像セットでの矩形。yはシート番号×`SHEET_STRIDE`を含む */
  rect: IfSprite;
  /** 矩形の画素index。幅×高さ */
  pixels: Uint8Array;
}

export interface ExtractedSprites {
  /** シート番号 → パレット。取り出したspriteがあるシートだけを持つ */
  palettes: Map<number, Uint8Array>;
  /** sprite番号 → 取り出したsprite */
  sprites: Map<number, ExtractedSprite>;
}

export const sheetOfSprite = (sprite: IfSprite): number =>
  Math.floor(sprite.y / SHEET_STRIDE);

/** `indices`のspriteを取り出す。素材に無い番号が`indices`にあれば例外にする */
export function extractSprites(
  source: IfPackage,
  indices: Iterable<number>,
): ExtractedSprites {
  const decoded = new Map<number, ReturnType<typeof decodeIndices8>>();
  const palettes = new Map<number, Uint8Array>();
  const sprites = new Map<number, ExtractedSprite>();
  for (const index of new Set(indices)) {
    const rect = source.metadata.sprites[index];
    if (!rect) {
      throw new Error(`djt sprite ${index} が無い`);
    }
    const sheetIndex = sheetOfSprite(rect);
    const sheet = source.metadata.sheets[sheetIndex];
    if (!decoded.has(sheetIndex)) {
      decoded.set(
        sheetIndex,
        decodeIndices8(
          source.files[sheetIndex + 1],
          sheet.width,
          sheet.height,
        ),
      );
    }
    const { indices: sheetPixels, palette } = decoded.get(sheetIndex)!;
    palettes.set(sheetIndex, palette);
    const top = rect.y - sheetIndex * SHEET_STRIDE;
    const pixels = new Uint8Array(rect.w * rect.h);
    for (let row = 0; row < rect.h; row++) {
      const from = (top + row) * sheet.width + rect.x;
      pixels.set(sheetPixels.subarray(from, from + rect.w), row * rect.w);
    }
    sprites.set(index, { index, pixels, rect });
  }
  return { palettes, sprites };
}

const WORD = 4;

/**
 * リトルエンディアンのu32の並びである。
 * パレット数、パレットごとにシート番号・長さ・バイト列、sprite数、
 * spriteごとにsprite番号・x・y・w・h・画素の順に並ぶ。
 */
export function serializeExtractedSprites(
  { palettes, sprites }: ExtractedSprites,
): Uint8Array {
  const paletteBytes = [...palettes.values()]
    .reduce((sum, palette) => sum + 2 * WORD + palette.length, 0);
  const spriteBytes = [...sprites.values()]
    .reduce((sum, sprite) => sum + 5 * WORD + sprite.pixels.length, 0);
  const out = new Uint8Array(2 * WORD + paletteBytes + spriteBytes);
  const view = new DataView(out.buffer);
  let offset = 0;
  const word = (value: number): void => {
    view.setUint32(offset, value, true);
    offset += WORD;
  };
  const bytes = (value: Uint8Array): void => {
    out.set(value, offset);
    offset += value.length;
  };
  word(palettes.size);
  for (const [sheet, palette] of palettes) {
    [sheet, palette.length].forEach(word);
    bytes(palette);
  }
  word(sprites.size);
  for (const { index, pixels, rect } of sprites.values()) {
    [index, rect.x, rect.y, rect.w, rect.h].forEach(word);
    bytes(pixels);
  }
  return out;
}

export function parseExtractedSprites(file: Uint8Array): ExtractedSprites {
  const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
  let offset = 0;
  const word = (): number => {
    const value = view.getUint32(offset, true);
    offset += WORD;
    return value;
  };
  const bytes = (length: number): Uint8Array => {
    const value = file.slice(offset, offset + length);
    offset += length;
    return value;
  };
  const palettes = new Map<number, Uint8Array>();
  for (let count = word(); count > 0; count--) {
    const sheet = word();
    palettes.set(sheet, bytes(word()));
  }
  const sprites = new Map<number, ExtractedSprite>();
  for (let count = word(); count > 0; count--) {
    const [index, x, y, w, h] = [word(), word(), word(), word(), word()];
    sprites.set(index, { index, pixels: bytes(w * h), rect: { h, w, x, y } });
  }
  if (offset !== file.length) {
    throw new Error("取り出したspriteのファイルの長さが合わない");
  }
  return { palettes, sprites };
}
