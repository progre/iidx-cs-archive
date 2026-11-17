// PBの共有画像セットへ、素材の画像セットのspriteを足す。
// パレットはシートごとに異なるので、素材側の元シート単位で新シートへ詰め、
// 既存シートの後ろへ足す。sprite座標は、シート番号×1024をyへ加えて表す。
// 素材の文字をシルバーにそろえるときは、足すシートのspriteの明るさの分布を、
// PBのもとからシルバーのspriteの分布に合わせる。

import type { IfPackage } from "@csa/core";
import { buildIfPackage, parseMetadata } from "../../format/mod.ts";
import { buildImageSetMetadata } from "../metadata.ts";
import {
  decodeIndices8,
  encodeTexture8,
  type SheetRect,
  silverReference,
  silverSprites,
} from "../../texture/mod.ts";
import {
  type ExtractedSprites,
  extractSprites,
  packSprites,
  SHEET_STRIDE,
  SHEET_WIDTH,
  sheetOfSprite,
} from "../sprites/mod.ts";

export interface MergedImageSet {
  /** 圧縮して組んだ`.if`。読んだ時に組む */
  readonly bytes: Uint8Array;
  /**
   * 組んだ画像セット。圧縮してから読み戻さずに、次の合成や分割へ渡せる。
   * `payloadEnd`は圧縮していないので0である。
   */
  package: IfPackage;
  /** 素材 sprite番号 → 新sprite番号 */
  spriteMap: Map<number, number>;
  summary: string;
}

interface DecodedSheet {
  height: number;
  indices: Uint8Array;
  palette: Uint8Array;
  width: number;
}

function decodeSheets(pkg: IfPackage): DecodedSheet[] {
  return pkg.metadata.sheets.map((sheet, i) => ({
    ...decodeIndices8(pkg.files[i + 1], sheet.width, sheet.height),
    height: sheet.height,
    width: sheet.width,
  }));
}

function blit(
  dst: Uint8Array,
  dstX: number,
  dstY: number,
  sprite: { pixels: Uint8Array; rect: { h: number; w: number } },
): void {
  for (let row = 0; row < sprite.rect.h; row++) {
    dst.set(
      sprite.pixels.subarray(row * sprite.rect.w, (row + 1) * sprite.rect.w),
      (dstY + row) * SHEET_WIDTH + dstX,
    );
  }
}

/**
 * PBの画像セットには、元からシルバーのspriteがある。
 * そのspriteの明るさから、手本の分布を作る。
 */
export function silverReferenceOf(pb: IfPackage): number[] {
  const sheets = decodeSheets(pb).map((sheet) => ({
    ...sheet,
    rects: [] as SheetRect[],
  }));
  for (const { x, y, w, h } of pb.metadata.sprites) {
    const sheet = Math.floor(y / SHEET_STRIDE);
    sheets[sheet].rects.push({ x, y: y - sheet * SHEET_STRIDE, w, h });
  }
  return silverReference(sheets);
}

/** `silver`(明るさの手本の分布)があれば、足すシートのspriteをシルバーにする */
export function mergeImageSet(
  pb: IfPackage,
  source: IfPackage,
  neededSprites: number[],
  silver: number[] | null,
): MergedImageSet {
  return mergeExtractedSprites(
    pb,
    extractSprites(source, neededSprites),
    neededSprites,
    silver,
  );
}

/** 素材の画像セットから取り出したspriteを足す。取り出していないspriteを足そうとすると例外にする */
export function mergeExtractedSprites(
  pb: IfPackage,
  source: ExtractedSprites,
  neededSprites: number[],
  silver: number[] | null,
): MergedImageSet {
  const needed = [...new Set(neededSprites)].sort((a, b) => a - b);
  const bySheet = new Map<number, number[]>();
  for (const index of needed) {
    const sprite = source.sprites.get(index);
    if (!sprite) {
      throw new Error(`djt sprite ${index} が無い`);
    }
    const sheet = sheetOfSprite(sprite.rect);
    bySheet.set(sheet, [...(bySheet.get(sheet) ?? []), index]);
  }

  const sheets = [...pb.metadata.sheets];
  const files = [...pb.files];
  const sprites = [...pb.metadata.sprites];
  const spriteMap = new Map<number, number>();
  for (
    const [sourceSheet, indices] of [...bySheet].sort((a, b) => a[0] - b[0])
  ) {
    const palette = source.palettes.get(sourceSheet) as Uint8Array;
    const rects = indices.map((i) => source.sprites.get(i)!.rect);
    const packed = packSprites(rects);
    const newSheets = packed.sheetHeights.map((height) => ({
      height,
      indices: new Uint8Array(SHEET_WIDTH * height),
      rects: [] as SheetRect[],
    }));
    indices.forEach((spriteIndex, k) => {
      const rect = rects[k];
      const place = packed.placements[k];
      blit(
        newSheets[place.sheet].indices,
        place.x,
        place.y,
        source.sprites.get(spriteIndex)!,
      );
      newSheets[place.sheet].rects.push({
        x: place.x,
        y: place.y,
        w: rect.w,
        h: rect.h,
      });
      spriteMap.set(spriteIndex, sprites.length);
      sprites.push({
        h: rect.h,
        w: rect.w,
        x: place.x,
        y: place.y + (sheets.length + place.sheet) * SHEET_STRIDE,
      });
    });
    for (const sheet of newSheets) {
      sheets.push({ height: sheet.height, width: SHEET_WIDTH });
      const indexed = { ...sheet, palette, width: SHEET_WIDTH };
      const painted = silver == null ? indexed : silverSprites(indexed, silver);
      files.push(
        encodeTexture8(
          painted.indices,
          painted.palette,
          SHEET_WIDTH,
          sheet.height,
        ),
      );
    }
  }
  files[0] = buildImageSetMetadata(pb.files[0], sheets, sprites);
  return {
    get bytes() {
      return buildIfPackage(files);
    },
    // 65枚目以降のシートのyは16bitに収まらないので、files[0]を読み直さない
    package: {
      files,
      metadata: { ...parseMetadata(files[0]), sheets, sprites },
      payloadEnd: 0,
    },
    spriteMap,
    summary: `sprites ${pb.metadata.sprites.length}+${needed.length} sheets ${
      sheets.map((s) => `${s.width}x${s.height}`).join(",")
    }`,
  };
}
