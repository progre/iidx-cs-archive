// spriteの矩形を幅640のシートへ棚積みで詰める。
// GSのPSMT8ページは128x64なので、シート高さは64の倍数、上限は既存画像セット最大の512とする。

import type { IfPackage, IfSprite } from "@csa/core";
import { encodeLzss, packIfFiles } from "../../format/mod.ts";
import { buildImageSetMetadata } from "../metadata.ts";

export const SHEET_WIDTH = 640;
const SHEET_HEIGHT_MAX = 512;
const HEIGHT_UNIT = 64;

export interface PackInput {
  h: number;
  w: number;
}

export interface Placement {
  sheet: number;
  x: number;
  y: number;
}

export interface PackResult {
  placements: Placement[];
  sheetHeights: number[];
}

/**
 * 入力順を保ってPlacementを返す。詰め順は高さ降順で、同じ棚には高さの近いものが並ぶ。
 * `padding`は矩形の四方に取る余白で、Placementは余白の内側の位置を指す
 */
export function packSprites(inputs: PackInput[], padding = 0): PackResult {
  const order = inputs
    .map((input, index) => ({
      h: input.h + padding * 2,
      index,
      w: input.w + padding * 2,
    }))
    .sort((a, b) => b.h - a.h || b.w - a.w);
  const placements: Placement[] = new Array(inputs.length);
  const sheetHeights: number[] = [];
  let sheet = 0;
  let shelfY = 0;
  let shelfH = 0;
  let x = 0;
  for (const item of order) {
    if (item.w > SHEET_WIDTH || item.h > SHEET_HEIGHT_MAX) {
      throw new Error(`sprite ${item.w}x${item.h} がシートに収まらない`);
    }
    if (x + item.w > SHEET_WIDTH) {
      shelfY += shelfH;
      shelfH = 0;
      x = 0;
    }
    if (shelfY + item.h > SHEET_HEIGHT_MAX) {
      sheetHeights[sheet] = roundHeight(shelfY);
      sheet++;
      shelfY = 0;
      shelfH = 0;
      x = 0;
    }
    placements[item.index] = { sheet, x: x + padding, y: shelfY + padding };
    x += item.w;
    shelfH = Math.max(shelfH, item.h);
  }
  if (inputs.length > 0) sheetHeights[sheet] = roundHeight(shelfY + shelfH);
  return { placements, sheetHeights };
}

function roundHeight(height: number): number {
  return Math.max(HEIGHT_UNIT, Math.ceil(height / HEIGHT_UNIT) * HEIGHT_UNIT);
}

// 共有画像セットをローダーが読める大きさの複数ファイルへ分ける。
// 上限は2つある。sheet数の32はローダーの管理表の大きさで決まる。
// 圧縮後の`0x300000`は選曲画面の読み込みバッファー(`0x429a80`)の大きさで決まる。
// 後者を超えると、読み込みスレッドが確保をやり直し続けて選曲画面が出ない。
// 先頭ファイルはPBのsheetとspriteをそのまま保ち、超えたsheetを後続ファイルへ順に移す。
// spriteのyはsheet番号×1024を含むので、移した先のsheet番号で振り直す。

const SHEET_STRIDE = 1024;
/** 選曲画面の`.if`読み込みバッファーの大きさ(原盤が置く値) */
export const READ_BUFFER_BYTES = 0x300000;

export interface SplitLimits {
  /** 1ファイルの圧縮後の上限バイト数 */
  byteLimit: number;
  /** 1ファイルのsheet上限 */
  sheetLimit: number;
}

export interface SplitSprite {
  /** 分割後のファイル番号。0が元のDATA1 index、1以降が追加ファイル */
  part: number;
  sprite: number;
}

export interface SplitImageSet {
  parts: Uint8Array[];
  /** 分割前のsprite番号 → 分割後の位置 */
  spriteMap: Map<number, SplitSprite>;
}

interface BuiltPart {
  bytes: Uint8Array;
  /** 分割後のsprite番号順に並べた、分割前のsprite番号 */
  spriteIndices: number[];
}

/** `first`から`count`枚のsheetを1ファイルに組む。spriteは分割前の並びを保つ */
function buildPart(
  pkg: IfPackage,
  textures: Uint8Array[],
  first: number,
  count: number,
): BuiltPart {
  const spriteIndices: number[] = [];
  const sprites: IfSprite[] = [];
  pkg.metadata.sprites.forEach((sprite, index) => {
    const sheet = Math.floor(sprite.y / SHEET_STRIDE) - first;
    if (sheet < 0 || sheet >= count) return;
    spriteIndices.push(index);
    sprites.push({
      ...sprite,
      y: sheet * SHEET_STRIDE + sprite.y % SHEET_STRIDE,
    });
  });
  const metadata = buildImageSetMetadata(
    pkg.files[0],
    pkg.metadata.sheets.slice(first, first + count),
    sprites,
  );
  const bytes = packIfFiles([
    { compressed: encodeLzss(metadata), decompressed: metadata.length },
    ...textures.slice(first, first + count).map((compressed, i) => ({
      compressed,
      decompressed: pkg.files[1 + first + i].length,
    })),
  ]);
  return { bytes, spriteIndices };
}

export function splitImageSet(
  pkg: IfPackage,
  limits: SplitLimits,
): SplitImageSet {
  if (limits.sheetLimit < 1) throw new Error("sheet上限は1以上にする");
  const sheetCount = pkg.metadata.sheets.length;
  const textures = pkg.files.slice(1).map(encodeLzss);
  const parts: Uint8Array[] = [];
  const spriteMap = new Map<number, SplitSprite>();
  let first = 0;
  while (first < sheetCount) {
    // 上限に収まる限りsheetを足していき、収まらなくなる直前で1ファイルにする
    let built = buildPart(pkg, textures, first, 1);
    if (built.bytes.length > limits.byteLimit) {
      throw new Error(`sheet ${first}だけで${limits.byteLimit}バイトを超える`);
    }
    let count = 1;
    while (count < limits.sheetLimit && first + count < sheetCount) {
      const candidate = buildPart(pkg, textures, first, count + 1);
      if (candidate.bytes.length > limits.byteLimit) break;
      built = candidate;
      count++;
    }
    built.spriteIndices.forEach((index, sprite) =>
      spriteMap.set(index, { part: parts.length, sprite })
    );
    parts.push(built.bytes);
    first += count;
  }
  return { parts, spriteMap };
}
