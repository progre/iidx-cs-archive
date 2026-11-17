// 絵をシートへ焼く。置き場所はこのパッケージが決める。画素indexと色表は`indexSheet`が決める。

import type { Image } from "@csa/core";
import { encodeSheet, layoutSheets, type SheetLayout } from "./sheet.ts";

export interface PackedSheets {
  /** encodeSheet済みのtexture file。layoutのシートと同じ並び */
  files: Uint8Array[];
  heights: number[];
  layout: SheetLayout;
  /** 入力の並びに対応するsprite矩形。yはシート内の位置 */
  sprites: SheetLayout["sprites"];
}

/** シートの画素indexと色表を決める。`contents/display`の`indexSheet`を受ける */
export type IndexSheet = (
  members: readonly { image: Image; x: number; y: number }[],
  padding: number,
  width: number,
  height: number,
) => { colors: number[][]; indices: Uint8Array };

/**
 * 絵を幅640のシートへ置き、シートごとに色表を組んで8bppへ焼く。
 * 入力の並びは保つので、呼び出し側は添字でsprite矩形を引ける。
 */
export function packImages(
  indexSheet: IndexSheet,
  images: Image[],
  padding = 0,
): PackedSheets {
  const layout = layoutSheets(
    images.map((image) => ({ h: image.height, w: image.width })),
    padding,
  );
  const files = layout.heights.map((height, sheet) => {
    const { colors, indices } = indexSheet(
      layout.members[sheet].map((i) => ({
        image: images[i],
        x: layout.sprites[i].x,
        y: layout.sprites[i].y,
      })),
      padding,
      layout.width,
      height,
    );
    return encodeSheet(indices, colors, layout.width, height);
  });
  return { files, heights: layout.heights, layout, sprites: layout.sprites };
}
