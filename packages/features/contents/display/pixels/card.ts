// legacyの曲名カードの絵を、1枚のシートの画素indexと色表にする。
// PB・emp・djtのカードは全曲、sheet1枚・sprite1件(298x349)で、
// 原盤のカードが全曲で使うsprite矩形をlegacyの絵の枠にする。

import type { Image } from "@csa/core";
import { colorKey, countColors, quantize } from "./quantize.ts";

/** sheetは128の倍数幅・64の倍数高さ(原盤既出の寸法から) */
const SHEET_UNIT = { h: 64, w: 128 };

/** 原盤のカードが全曲で使うsprite矩形。画面の配置がこれを前提にしている */
export const CARD_FRAME = { h: 349, w: 298 };

/** 原盤のカードは縦に2倍へ伸ばして描かれ、ゲームが縦を半分に潰して表示する */
export const CARD_TALL = 2;

export interface IndexedCard {
  /** 色表。i番目の色のindexはi+1で、成分はRGBAの0..255 */
  colors: number[][];
  /** sheet幅×sheet高さの画素index。0は透過 */
  indices: Uint8Array;
  sheet: { h: number; w: number };
}

/** 枠に合わせ済みの絵を、sheetの左上に置いた画素indexにする */
export function indexCard(art: Image): IndexedCard {
  const sheet = {
    h: Math.ceil(art.height / SHEET_UNIT.h) * SHEET_UNIT.h,
    w: Math.ceil(art.width / SHEET_UNIT.w) * SHEET_UNIT.w,
  };
  const { colors, indexOf } = quantize(countColors([art]));
  const indices = new Uint8Array(sheet.w * sheet.h);
  for (let y = 0; y < art.height; y++) {
    for (let x = 0; x < art.width; x++) {
      const from = (y * art.width + x) * 4;
      if (art.rgba[from + 3] === 0) {
        continue;
      }
      const index = indexOf.get(colorKey(art.rgba, from));
      if (index === undefined) {
        throw new Error("色表に無い色がある");
      }
      indices[y * sheet.w + x] = index;
    }
  }
  return { colors, indices, sheet };
}
