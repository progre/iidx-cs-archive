// legacyの絵から曲中オーバーレイのパッケージを組む。
// 絵は余白つきで棚積みのシートへ置き、場面animationのmetadataと並べて1本の`.if`にする。

import type { IfSprite, Image } from "@csa/core";
import {
  buildIfPackage,
  buildSceneMetadata,
  type Scene,
} from "../format/mod.ts";
import { SHEET_WIDTH } from "../image_set/sprites/mod.ts";
import {
  type IndexSheet,
  packImages,
  type SheetLayout,
} from "../title_image_set/mod.ts";

/** 1本のパッケージが持てるsheet数 */
const SHEET_LIMIT = 32;
/** spriteのyはシートを縦に1024間隔で積んだ座標 */
const SHEET_STRIDE = 1024;

/**
 * 矩形の四方に取る余白。縦2倍やDPの縮小でGSが隣の画素を混ぜて読んでも、
 * 余白に写した端の画素が読まれるので他の絵の色が出ない
 */
export const OVERLAY_PADDING = 2;

/** シート内の位置を、シート番号を含むyの矩形にする */
export const overlayRects = (layout: SheetLayout): IfSprite[] =>
  layout.sprites.map((rect) => ({
    h: rect.h,
    w: rect.w,
    x: rect.x,
    y: rect.sheet * SHEET_STRIDE + rect.y,
  }));

export const fitsSheetLimit = (sheetCount: number): boolean =>
  sheetCount <= SHEET_LIMIT;

export function buildLegacyOverlayPackage(
  layout: SheetLayout,
  files: readonly Uint8Array[],
  scenes: readonly Scene[],
): Uint8Array {
  const metadata = buildSceneMetadata(
    layout.heights.map((height) => ({ height, width: SHEET_WIDTH })),
    overlayRects(layout),
    scenes,
  );
  return buildIfPackage([metadata, ...files]);
}

/** 絵をシートへ焼く。`fits`は上限に収まったかを示す。`packageOf`は場面から`.if`を組む */
export function packLegacyOverlay(indexSheet: IndexSheet, images: Image[]): {
  fits: boolean;
  packageOf: (scenes: readonly Scene[]) => Uint8Array;
  sheets: number;
} {
  const packed = packImages(indexSheet, images, OVERLAY_PADDING);
  return {
    fits: fitsSheetLimit(packed.files.length),
    packageOf: (scenes) =>
      buildLegacyOverlayPackage(packed.layout, packed.files, scenes),
    sheets: packed.files.length,
  };
}
