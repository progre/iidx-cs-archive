// 文字から共有画像セットのspriteを描く。字の輪郭はopentype.js、画素化はresvg-wasmが行う。

import { initWasm, Resvg } from "@resvg/resvg-wasm";
import resvgWasm from "@resvg/resvg-wasm/index_bg.wasm" with { type: "bytes" };
import { loadFont } from "./font.ts";
import { layoutText, type TextSegment } from "./layout.ts";
import type { TextStyle } from "./style.ts";
import { svgOf } from "./svg.ts";

/** 描いた画素。rgbaは色に不透明度を掛けていない並び */
export interface TextImage {
  width: number;
  height: number;
  rgba: Uint8Array;
}

let ready: Promise<void> | null = null;

/** resvg-wasmのwasmを1度だけ読み込む */
function initResvg(): Promise<void> {
  ready ??= (async () => {
    await initWasm(resvgWasm);
  })();
  return ready;
}

async function rendered(
  segments: TextSegment[],
  style: TextStyle,
  fontDirectory: string,
) {
  await initResvg();
  const font = await loadFont(fontDirectory + "/" + style.font);
  const layout = layoutText(font, segments, style);
  // 文字は輪郭で描くので、システムのフォントは読まない
  const resvg = new Resvg(svgOf(layout, style), {
    font: { loadSystemFonts: false },
  });
  return resvg.render();
}

/** resvgの画素は色に不透明度を掛けてあるので、掛ける前に戻す */
function unpremultiplied(pixels: Uint8Array): Uint8Array {
  return pixels.map((value, i) => {
    const alpha = pixels[i - (i % 4) + 3];
    return i % 4 === 3 || alpha === 0 || alpha === 255
      ? value
      : Math.min(255, Math.round(value * 255 / alpha));
  });
}

/** `TextStyle`の大きさで描いた画素を返す */
export async function renderTextImage(
  segments: TextSegment[],
  style: TextStyle,
  fontDirectory: string,
): Promise<TextImage> {
  const image = await rendered(segments, style, fontDirectory);
  return {
    width: image.width,
    height: image.height,
    rgba: unpremultiplied(image.pixels),
  };
}

/** `TextStyle`の大きさで描き、透明な背景のPNGを`out`へ書く。描いた画像の大きさを返す */
export async function renderText(
  segments: TextSegment[],
  style: TextStyle,
  fontDirectory: string,
  out: string,
): Promise<{ width: number; height: number }> {
  const image = await rendered(segments, style, fontDirectory);
  await Deno.writeFile(out, image.asPng());
  return { width: image.width, height: image.height };
}
