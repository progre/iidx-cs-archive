// シートに置いた絵を、シート1枚ぶんの画素indexと色表にする。
// 1シートには1つの色表しか持てないので、シートごとに色をまとめる(quantize.ts)。

import type { Image } from "@csa/core";
import { colorKey, countColors, quantize } from "./quantize.ts";

/** シートの中に置いた絵。xとyは絵の左上の位置 */
export interface PlacedImage {
  image: Image;
  x: number;
  y: number;
}

export interface IndexedSheet {
  /** 色表。i番目の色のindexはi+1で、成分はRGBAの0..255 */
  colors: number[][];
  /** 幅×高さの画素index。0は透過 */
  indices: Uint8Array;
}

const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), max);

/**
 * `padding`を取ると絵の四方にその幅の余白を置き、余白には端の画素を写す。
 * GSは拡縮のとき隣の画素を混ぜて読むので、余白が無いと絵の縁に隣の絵の色が出る。
 * 絵は渡された順に置くので、後の絵の余白は先の絵を上書きする。
 */
export function indexSheet(
  members: readonly PlacedImage[],
  padding: number,
  width: number,
  height: number,
): IndexedSheet {
  const { colors, indexOf } = quantize(
    countColors(members.map((member) => member.image)),
  );
  const indices = new Uint8Array(width * height);
  for (const { image, x: left, y: top } of members) {
    for (let y = -padding; y < image.height + padding; y++) {
      for (let x = -padding; x < image.width + padding; x++) {
        const from = (clamp(y, image.height - 1) * image.width +
          clamp(x, image.width - 1)) * 4;
        if (image.rgba[from + 3] === 0) {
          continue;
        }
        const index = indexOf.get(colorKey(image.rgba, from));
        if (index === undefined) {
          throw new Error("色表に無い色がある");
        }
        indices[(top + y) * width + left + x] = index;
      }
    }
  }
  return { colors, indices };
}
