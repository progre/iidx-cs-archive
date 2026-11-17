// frameの小片を1枚に合成してから、小片ごとに境目の外側1pxまで含めて切り直す。
// PBは1 frameを1枚のspriteで描くが、CSAは小片ごとに描く。DPの縮小では小片ごとの丸めで
// 境目に隙間が出るので、隣の画素を含めて切り出し、隣と重ねて隙間を埋める(実機: 十字の線)。
// index 0とalpha 0は透過である。

import type { Image } from "@csa/core";
import type { TileOf } from "./ifs.ts";
import { colorsOfTile, toRgba } from "./palette.ts";
import { sourceOf, type Sprite } from "./sprite.ts";
import { SIDE } from "./tile.ts";

/** 小片の四方に含める隣の画素の幅。小片の使い回しが減るので、sheetが溢れる曲は0にする */
export const SKIRT = 1;
export type SetOf = (set: number) => Uint16Array | null;

export interface Composed extends Image {
  /** 画面座標での左上 */
  left: number;
  top: number;
}

function drawSprite(
  composed: Composed,
  tileOf: TileOf,
  setOf: SetOf,
  sprite: Sprite,
): void {
  const tile = tileOf(sprite.tile);
  const colors = setOf(sprite.set);
  if (tile === null || colors === null) return;
  const palette = colorsOfTile(colors, sprite.selector, tile.kind);
  for (let y = 0; y < sprite.h; y++) {
    for (let x = 0; x < sprite.w; x++) {
      const [sx, sy] = sourceOf(sprite, x, y);
      if (sx >= SIDE || sy >= SIDE) continue;
      const index = tile.indices[sy * SIDE + sx];
      if (index === 0) continue;
      const color = toRgba(palette[index] ?? 0);
      if (color[3] === 0) continue;
      const px = sprite.x - composed.left + x;
      const py = sprite.y - composed.top + y;
      composed.rgba.set(color, (py * composed.width + px) * 4);
    }
  }
}

/** frameの小片を並びどおりに重ねて1枚にする。範囲は小片の外側にskirtを足す */
export function composeFrame(
  tileOf: TileOf,
  setOf: SetOf,
  sprites: readonly Sprite[],
  skirt: number,
): Composed {
  const left = Math.min(...sprites.map((s) => s.x)) - skirt;
  const top = Math.min(...sprites.map((s) => s.y)) - skirt;
  const width = Math.max(...sprites.map((s) => s.x + s.w)) + skirt - left;
  const height = Math.max(...sprites.map((s) => s.y + s.h)) + skirt - top;
  const composed = {
    height,
    left,
    rgba: new Uint8Array(width * height * 4),
    top,
    width,
  };
  for (const sprite of sprites) drawSprite(composed, tileOf, setOf, sprite);
  return composed;
}

/** 小片1つを自分の画素だけで焼く */
export function bakeSprite(
  tileOf: TileOf,
  setOf: SetOf,
  sprite: Sprite,
): Image {
  const own = {
    height: sprite.h,
    left: sprite.x,
    rgba: new Uint8Array(sprite.w * sprite.h * 4),
    top: sprite.y,
    width: sprite.w,
  };
  drawSprite(own, tileOf, setOf, sprite);
  return own;
}

/**
 * 小片の矩形をskirtぶん広げて切る。外側は合成した絵から、内側は自分の画素から取る。
 * 内側まで合成から取ると、重なる小片の画素が写り込んで使い回しが消える
 */
export function cutSprite(
  composed: Composed,
  own: Image,
  sprite: Sprite,
  skirt: number,
): Image {
  const width = sprite.w + skirt * 2;
  const height = sprite.h + skirt * 2;
  const rgba = new Uint8Array(width * height * 4);
  const x0 = sprite.x - skirt - composed.left;
  for (let y = 0; y < height; y++) {
    const from = ((sprite.y - skirt - composed.top + y) * composed.width + x0) *
      4;
    rgba.set(composed.rgba.subarray(from, from + width * 4), y * width * 4);
  }
  for (let y = 0; y < sprite.h; y++) {
    rgba.set(
      own.rgba.subarray(y * sprite.w * 4, (y + 1) * sprite.w * 4),
      ((y + skirt) * width + skirt) * 4,
    );
  }
  return { height, rgba, width };
}

/** 見た目が同じ絵を1件にまとめる鍵(FNV-1a + 寸法)。衝突は呼び出し側が画素で確かめる */
export function imageKey(image: Image): string {
  let hash = 0x811c9dc5;
  for (const byte of image.rgba) {
    hash = Math.imul(hash ^ byte, 0x01000193) >>> 0;
  }
  return `${image.width}x${image.height}:${hash.toString(16)}`;
}

export const sameImage = (a: Image, b: Image): boolean =>
  a.width === b.width && a.height === b.height &&
  a.rgba.every((value, i) => value === b.rgba[i]);
