// シートのspriteを、濃淡の位置を残したままシルバーにする。
// 明るさは、輝度をspriteで最も明るい画素で割った値で表す。
// 塗りの明るさを明るい順に並べ、その順位をシルバーの手本の分布の同じ順位の値へ置き換える。
// 1枚のシートのパレットを色の違う複数のspriteが共有するので、パレットは作り直す。

import { clutIndex, PALETTE_BYTES } from "./texture.ts";

/** シートの中の矩形(px) */
export interface SheetRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 画素の値とパレットで表したシートと、その中のsprite */
export interface IndexedSheet {
  indices: Uint8Array;
  palette: Uint8Array;
  width: number;
  rects: SheetRect[];
}

const COLORS = PALETTE_BYTES / 4;
/** 不透明のalpha */
const OPAQUE = 0x80;
/** これより暗い画素は縁とみなし、手本の分布に含めず置き換えもしない */
const OUTLINE_BELOW = 0.3;
/** 塗りの彩度の平均がこれ未満のspriteを、もとからシルバーとみなす */
const SILVER_SATURATION = 0.1;
/** 手本の分布を何段の分位点で持つか */
const REFERENCE_STEPS = 256;

interface Color {
  luminance: number;
  saturation: number;
  alpha: number;
}

function colorsOf(palette: Uint8Array): Color[] {
  return Array.from({ length: COLORS }, (_, value) => {
    const i = clutIndex(value) * 4;
    const [r, g, b, alpha] = palette.subarray(i, i + 4);
    const max = Math.max(r, g, b);
    return {
      luminance: 0.299 * r + 0.587 * g + 0.114 * b,
      saturation: max === 0 ? 0 : (max - Math.min(r, g, b)) / max,
      alpha,
    };
  });
}

/** spriteの画素ごとのシート上の位置、色、明るさ */
function pixelsOf(sheet: IndexedSheet, colors: Color[], rect: SheetRect) {
  const pixels = Array.from({ length: rect.w * rect.h }, (_, i) => {
    const offset = (rect.y + Math.floor(i / rect.w)) * sheet.width + rect.x +
      i % rect.w;
    return { offset, color: colors[sheet.indices[offset]] };
  });
  const top = Math.max(
    ...pixels.filter((p) => p.color.alpha > 0).map((p) => p.color.luminance),
  );
  return pixels.map((p) => ({
    ...p,
    brightness: top > 0 ? p.color.luminance / top : 0,
  }));
}

type Pixel = ReturnType<typeof pixelsOf>[number];

const isFill = (p: Pixel) =>
  p.color.alpha >= OPAQUE && p.brightness > OUTLINE_BELOW;

/** 昇順に並べた値の、割合qの位置の値 */
const quantile = (sorted: number[], q: number) =>
  sorted[Math.round(q * (sorted.length - 1))];

/** もとからシルバーのspriteの塗りの明るさを、昇順の分位点にする */
export function silverReference(sheets: IndexedSheet[]): number[] {
  const fills = sheets.flatMap((sheet) => {
    const colors = colorsOf(sheet.palette);
    return sheet.rects.map((rect) =>
      pixelsOf(sheet, colors, rect).filter(isFill)
    )
      .filter((fill) => {
        const sum = fill.reduce((a, p) => a + p.color.saturation, 0);
        return fill.length > 0 && sum / fill.length < SILVER_SATURATION;
      });
  });
  const sorted = fills.flat().map((p) => p.brightness).sort((a, b) => a - b);
  if (sorted.length === 0) {
    throw new Error("シルバーの手本になるspriteが無い");
  }
  return Array.from(
    { length: REFERENCE_STEPS },
    (_, k) => quantile(sorted, k / (REFERENCE_STEPS - 1)),
  );
}

/** 塗りの明るさを、sprite内の順位で手本の値へ置き換える */
function grayOf(pixels: Pixel[], reference: number[]): Map<number, number> {
  const own = pixels.filter(isFill).map((p) => p.brightness)
    .sort((a, b) => a - b);
  const rank = (brightness: number) => {
    let lo = 0, hi = own.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      own[mid] < brightness ? lo = mid + 1 : hi = mid;
    }
    return own.length <= 1 ? 1 : Math.min(1, lo / (own.length - 1));
  };
  return new Map(pixels.map((p) => [
    p.offset,
    isFill(p) ? quantile(reference, rank(p.brightness)) : p.brightness,
  ]));
}

/** 灰色とalphaの組が256色に収まるまで、灰色の段階を粗くする */
function quantized(grays: number[], alphas: number[]): number[] {
  for (let step = 1;; step++) {
    const keys = grays.map((gray, i) =>
      Math.min(255, Math.round(gray / step) * step) << 8 | alphas[i]
    );
    if (new Set(keys).size <= COLORS) {
      return keys;
    }
  }
}

/**
 * シートの`rects`の各spriteをシルバーにした、画素の値とパレットを返す。
 * 矩形の外の画素は輝度の灰色にする。alphaは変えない
 */
export function silverSprites(
  sheet: IndexedSheet,
  reference: number[],
): { indices: Uint8Array; palette: Uint8Array } {
  const colors = colorsOf(sheet.palette);
  const grays = Array.from(sheet.indices, (v) => colors[v].luminance);
  for (const rect of sheet.rects) {
    const brightness = grayOf(pixelsOf(sheet, colors, rect), reference);
    brightness.forEach((value, offset) => grays[offset] = value * 255);
  }
  const keys = quantized(
    grays.map((gray) => Math.min(255, Math.round(gray))),
    Array.from(sheet.indices, (v) => colors[v].alpha),
  );
  const values = new Map([...new Set(keys)].map((key, value) => [key, value]));
  const palette = new Uint8Array(PALETTE_BYTES);
  for (const [key, value] of values) {
    const gray = key >> 8;
    palette.set([gray, gray, gray, key & 0xff], clutIndex(value) * 4);
  }
  return {
    indices: Uint8Array.from(keys, (key) => values.get(key)!),
    palette,
  };
}
