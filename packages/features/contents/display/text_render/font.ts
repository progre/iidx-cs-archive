// フォントの読み込み。opentype.jsは型定義を持たないので、使う機能だけを型にする。

import opentype from "opentype.js";

/** opentype.jsのPathの命令。曲線の制御点はx1・y1・x2・y2に入る */
export interface PathCommand {
  type: "M" | "L" | "C" | "Q" | "Z";
  x?: number;
  y?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
}

/**
 * 字の輪郭。opentype.js 2.0.0の`toPathData()`は字によってNaNを出すので使わず、
 * `commands`からSVGのd属性を組み立てる
 */
export interface GlyphPath {
  commands: PathCommand[];
  getBoundingBox(): { x1: number; y1: number; x2: number; y2: number };
}

/** 文字の輪郭と送り幅を返すフォント。yは下向きで、基準線がyになる */
export interface GlyphFont {
  getPath(
    text: string,
    x: number,
    y: number,
    fontSize: number,
    options: { kerning: boolean },
  ): GlyphPath;
  getAdvanceWidth(
    text: string,
    fontSize: number,
    options: { kerning: boolean },
  ): number;
}

const cache = new Map<string, GlyphFont>();

export async function loadFont(path: string): Promise<GlyphFont> {
  const cached = cache.get(path);
  if (cached != null) {
    return cached;
  }
  const bytes = await Deno.readFile(path);
  const font: GlyphFont = opentype.parse(bytes.buffer);
  cache.set(path, font);
  return font;
}
