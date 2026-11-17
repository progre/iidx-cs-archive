// 曲名カードの絵(sprite)を、PBのHUDが描ける置き方へ並べ直す。
// PBのHUDは、spriteのx・yを読み出し位置へ2回足す(`0x1f8eb8`と`0x135670`)。
// このため、どのspriteも、自分のsheetの左上(x=0、sheetの中のy=0)から始まらなければならない。
// PBのカードは、spriteを1枚ずつ別のsheetに置き、yの1024の位でsheetを指す。

import type { IfSheet, IfSprite } from "@csa/core";
import { buildIfPackage, padToSector, parseIfPackage } from "../format/mod.ts";
import {
  imageSetMetadataOf,
  type ImageSetMetadataParts,
} from "../image_set/mod.ts";
import { decodeIndices8, encodeTexture8 } from "../texture/mod.ts";

/** spriteのyのうち、sheetの番号を表す位 */
const SHEET_STRIDE = 1024;
/** 新しいsheetの幅と高さの刻み。PBのカードは298x349の絵を384x384のsheetに置く */
const SHEET_STEP = 128;

const sheetIndexOf = (sprite: IfSprite) => Math.floor(sprite.y / SHEET_STRIDE);
const yInSheetOf = (sprite: IfSprite) => sprite.y % SHEET_STRIDE;
const isAtSheetOrigin = (sprite: IfSprite) =>
  sprite.x === 0 && yInSheetOf(sprite) === 0;
const stepUp = (length: number) => Math.ceil(length / SHEET_STEP) * SHEET_STEP;

/**
 * metadataから、sheetとspriteで決まらない部分を取り出す。
 * 世代によってsprite表の位置が違う(redは`0x90`)ので、位置はヘッダーから読む
 */
function metadataPartsOf(metadata: Uint8Array): ImageSetMetadataParts {
  const dv = new DataView(
    metadata.buffer,
    metadata.byteOffset,
    metadata.byteLength,
  );
  if (dv.getUint16(4, true) !== 1) {
    throw new Error("曲名カードのanimationが1件でない");
  }
  const animationTable = dv.getUint32(0x0c, true);
  const animation0 = dv.getUint32(animationTable, true);
  return {
    animation: metadata.subarray(animation0, animationTable),
    head: dv.getUint16(0, true),
  };
}

interface PlacedSprite {
  sheet: IfSheet;
  sprite: IfSprite;
  texture: Uint8Array;
}

/**
 * どのspriteもsheetの左上から始まるなら`null`を返す。
 * そうでなければ、spriteを1枚ずつ別のsheetの左上へ写した`.if`を返す。画素とパレットは変えない
 */
export function withSpritesAtSheetOrigin(bytes: Uint8Array): Uint8Array | null {
  const pkg = parseIfPackage(bytes);
  const { sheets, sprites } = pkg.metadata;
  if (sprites.every(isAtSheetOrigin)) {
    return null;
  }
  const decoded = sheets.map((sheet, index) =>
    decodeIndices8(pkg.files[index + 1], sheet.width, sheet.height)
  );
  const placed = sprites.map((sprite, index): PlacedSprite => {
    const source = sheets[sheetIndexOf(sprite)];
    const { indices, palette } = decoded[sheetIndexOf(sprite)];
    const sheet = { height: stepUp(sprite.h), width: stepUp(sprite.w) };
    const copied = new Uint8Array(sheet.width * sheet.height);
    Array.from({ length: sprite.h }, (_, row) => {
      const from = (yInSheetOf(sprite) + row) * source.width + sprite.x;
      copied.set(indices.subarray(from, from + sprite.w), row * sheet.width);
    });
    return {
      sheet,
      sprite: { h: sprite.h, w: sprite.w, x: 0, y: index * SHEET_STRIDE },
      texture: encodeTexture8(copied, palette, sheet.width, sheet.height),
    };
  });
  const metadata = imageSetMetadataOf(
    metadataPartsOf(pkg.files[0]),
    placed.map(({ sheet }) => sheet),
    placed.map(({ sprite }) => sprite),
  );
  return padToSector(
    buildIfPackage([metadata, ...placed.map(({ texture }) => texture)]),
  );
}
