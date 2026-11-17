// legacyの絵をPBの共有画像セットへ足せるシートへ置く。
// 置き場所はここで決め、画素indexと色表は呼び出し側が作って渡す。

import type { IfSprite } from "@csa/core";
import { packSprites, SHEET_WIDTH } from "../image_set/sprites/mod.ts";
import { clutIndex, encodeTexture8, PALETTE_BYTES } from "../texture/mod.ts";

// 色の並びをPBのCLUTへ並べる。
// PBのCLUTは256色×RGBAで、alphaは0..0x80(texture.ts)。index 0は透過に充てる。
/**
 * `colors`のi番目の色をindex i+1に置く。成分はRGBAの0..255で、
 * GSのalphaは0..0x80で表し、0x80が不透明である。
 * そのため、alphaは0..0x80へ縮めて写す。
 */
export function encodePalette(
  colors: readonly (readonly number[])[],
): Uint8Array {
  const palette = new Uint8Array(PALETTE_BYTES);
  colors.forEach((color, i) => {
    const at = clutIndex(i + 1) * 4;
    palette[at] = color[0];
    palette[at + 1] = color[1];
    palette[at + 2] = color[2];
    palette[at + 3] = Math.round(color[3] * 128 / 255);
  });
  return palette;
}

export interface SheetLayout {
  /** シートの幅 */
  width: number;
  /** シートごとの高さ */
  heights: number[];
  /** 入力の並びに対応するsprite矩形。yはシート内の位置 */
  sprites: (IfSprite & { sheet: number })[];
  /** シートごとに置いた絵の、入力での添字。入力の並びを保つ */
  members: number[][];
}

/**
 * 絵の寸法を幅640のシートへ棚積みで詰める。
 * `padding`を取ると矩形の四方にその幅の余白を置く。
 */
export function layoutSheets(
  sizes: readonly { h: number; w: number }[],
  padding = 0,
): SheetLayout {
  const packed = packSprites(sizes.map((size) => ({ ...size })), padding);
  const sprites = sizes.map((size, i) => ({
    h: size.h,
    sheet: packed.placements[i].sheet,
    w: size.w,
    x: packed.placements[i].x,
    y: packed.placements[i].y,
  }));
  return {
    heights: packed.sheetHeights,
    members: packed.sheetHeights.map((_, sheet) =>
      sprites.flatMap((rect, i) => rect.sheet === sheet ? [i] : [])
    ),
    sprites,
    width: SHEET_WIDTH,
  };
}

/** 画素indexと色表からtexture fileを焼く */
export const encodeSheet = (
  indices: Uint8Array,
  colors: readonly (readonly number[])[],
  width: number,
  height: number,
): Uint8Array => encodeTexture8(indices, encodePalette(colors), width, height);
