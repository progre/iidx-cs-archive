// 曲名カードを拡縮し、黒の背景の枠に収める。補間は jimp の BICUBIC を使う。

import { Jimp, ResizeStrategy } from "jimp";

/** RGBA 8bit の画素列 */
export interface Raster {
  height: number;
  rgba: Uint8Array;
  width: number;
}

function resize(image: Raster, width: number, height: number): Raster {
  const resized = Jimp.fromBitmap({
    data: image.rgba,
    height: image.height,
    width: image.width,
  }).resize({ h: height, mode: ResizeStrategy.BICUBIC, w: width });
  return {
    height,
    rgba: new Uint8Array(resized.bitmap.data),
    width,
  };
}

/**
 * 中央を基準に枠へ切り落とすか、足りない所を黒で埋める。
 * 黒の背景へ重ねる。
 * 透明な画素は不透明な黒になる。
 * 半透明な画素は黒と混ぜた色になる。
 * 出力の画素の alpha はすべて 255 である。
 */
function extent(image: Raster, frame: { h: number; w: number }): Raster {
  const rgba = new Uint8Array(frame.w * frame.h * 4);
  const offsetX = Math.floor((image.width - frame.w) / 2);
  const offsetY = Math.floor((image.height - frame.h) / 2);
  for (let y = 0; y < frame.h; y++) {
    for (let x = 0; x < frame.w; x++) {
      const out = (y * frame.w + x) * 4;
      rgba[out + 3] = 255;
      const sx = x + offsetX;
      const sy = y + offsetY;
      if (sx < 0 || sy < 0 || sx >= image.width || sy >= image.height) {
        continue;
      }
      const from = (sy * image.width + sx) * 4;
      const alpha = image.rgba[from + 3] / 255;
      for (let k = 0; k < 3; k++) {
        rgba[out + k] = Math.round(image.rgba[from + k] * alpha);
      }
    }
  }
  return { height: frame.h, rgba, width: frame.w };
}

/** 縦横別の倍率で拡縮し、中央を基準に枠へ切り落とすか黒で埋める */
export function resampleToFrame(
  image: Raster,
  ratioX: number,
  ratioY: number,
  frame: { h: number; w: number },
): Raster {
  const resized = resize(
    image,
    Math.round(image.width * ratioX),
    Math.round(image.height * ratioY),
  );
  return extent(resized, frame);
}
