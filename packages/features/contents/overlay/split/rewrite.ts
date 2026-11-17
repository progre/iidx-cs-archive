// 分けた本のmetadataを、元のmetadataと場面の使用範囲から書き直す。
// animation表は本数も項目数も元のまま残し、分けた後の本から辿れない項目だけを潰す。
// 組は`{animation, パッケージ}`で自己完結するので、番号を動かさなければ曲DB側は変わらない。

import type { IfMetadata, IfPackage } from "@csa/core";
import { rowOfSpriteY, type SceneUsage, sheetOfSpriteY } from "./usage.ts";

const ITEM_BYTES = 0x24;
const TERMINATOR = 0xffff;
const SHEET_TABLE_OFFSET = 0x10;
const SPRITE_BYTES = 8;

export interface SplitMetadata {
  metadata: Uint8Array;
  /** 元の番号。新しい番号はこの並びの添字 */
  sheets: number[];
  sprites: number[];
}

/** animationごとの項目の位置。書き換える前に全て集める */
function itemOffsets(dv: DataView): number[][] {
  const table = dv.getUint32(12, true);
  return Array.from({ length: dv.getUint16(4, true) }, (_, i) => {
    const offsets: number[] = [];
    let at = dv.getUint32(table + i * 4, true);
    for (; dv.getUint16(at + 2, true) !== TERMINATOR; at += ITEM_BYTES) {
      offsets.push(at);
    }
    return offsets;
  });
}

/**
 * 場面から辿れる項目は対象を新しいsprite番号へ振り直し、辿れない項目は
 * 種類0・対象0・不透明度0へ潰す(**PB実測**: ddの1本を2本に分けた1439・1440)。
 */
function rewriteItems(
  dv: DataView,
  reached: ReadonlySet<number>,
  sprites: ReadonlyMap<number, number>,
): void {
  const offsets = itemOffsets(dv);
  offsets.forEach((items, animation) => {
    if (reached.has(animation)) return;
    for (const at of items) {
      dv.setUint16(at, 0, true);
      dv.setUint16(at + 2, 0, true);
      dv.setUint16(at + 6, 0, true);
    }
  });
  offsets.forEach((items, animation) => {
    if (!reached.has(animation)) return;
    for (const at of items) {
      const kind = dv.getUint16(at, true);
      if (kind === 2 || kind === 3) continue;
      const target = sprites.get(dv.getUint16(at + 2, true));
      if (target === undefined) throw new Error("辿ったspriteが選ばれていない");
      dv.setUint16(at + 2, target, true);
    }
  });
}

/** metadataは長さを変えずに写す。animation数と表のoffsetとblockは触らない */
export function rewriteSplitMetadata(
  source: IfPackage,
  usage: SceneUsage,
): SplitMetadata {
  const sheets = [...usage.sheets].sort((a, b) => a - b);
  const sprites = [...usage.sprites].sort((a, b) => a - b);
  const sheetOf = new Map(sheets.map((sheet, index) => [sheet, index]));
  const spriteOf = new Map(sprites.map((sprite, index) => [sprite, index]));
  const metadata = new Uint8Array(source.files[0]);
  const dv = new DataView(metadata.buffer);
  dv.setUint16(2, sheets.length, true);
  dv.setUint16(6, sprites.length, true);
  sheets.forEach((sheet, index) => {
    const at = SHEET_TABLE_OFFSET + index * 4;
    dv.setUint16(at, source.metadata.sheets[sheet].width, true);
    dv.setUint16(at + 2, source.metadata.sheets[sheet].height, true);
  });
  source.metadata.sprites.forEach((_, index) => {
    const at = source.metadata.spriteInfoOffset + index * SPRITE_BYTES;
    const rect = source.metadata.sprites[sprites[index]];
    if (rect === undefined) {
      metadata.fill(0, at, at + SPRITE_BYTES);
      return;
    }
    const sheet = sheetOf.get(sheetOfSpriteY(rect.y));
    if (sheet === undefined) throw new Error("spriteのsheetが選ばれていない");
    dv.setUint16(at, rect.x, true);
    dv.setUint16(at + 2, (sheet << 10) | rowOfSpriteY(rect.y), true);
    dv.setUint16(at + 4, rect.w, true);
    dv.setUint16(at + 6, rect.h, true);
  });
  rewriteItems(dv, usage.animations, spriteOf);
  return { metadata, sheets, sprites };
}

/**
 * 組み直した本を読み直し、sheet数とsprite数を数える。
 * その数が、場面から集めたsheet数とsprite数(引数`split`)と同じであることを確かめる。
 */
export function assertSplitReadable(
  written: IfMetadata,
  split: Pick<SplitMetadata, "sheets" | "sprites">,
): void {
  if (
    written.sheets.length !== split.sheets.length ||
    written.sprites.length !== split.sprites.length
  ) {
    throw new Error("分けた`.if`を読み直せない");
  }
}
