// 焼き済みのシートを、画像セットの後ろへ足す。
// legacyには素材の画像セットが無いので、`mergeImageSet`の代わりにこちらを通す。
// sprite座標は、シート番号×1024をyへ加えて表す。

import type { IfPackage, IfSprite } from "@csa/core";
import { buildIfPackage, parseMetadata } from "../../format/mod.ts";
import { buildImageSetMetadata } from "../metadata.ts";
import { SHEET_WIDTH } from "../sprites/mod.ts";

/** 複数シートを1枚に見立てるときのシート間隔 */
const SHEET_STRIDE = 1024;

/** 焼き済みのシート。spriteのyはシート内の位置で、`sheet`が属するシートの番号を表す */
export interface PackedImages {
  files: Uint8Array[];
  heights: number[];
  sprites: readonly (IfSprite & { sheet: number })[];
}

export interface MergedImages {
  /** 圧縮して組んだ`.if`。読んだ時に組む */
  readonly bytes: Uint8Array;
  /** 組んだ画像セット。`payloadEnd`は圧縮していないので0である */
  package: IfPackage;
  /** 足したspriteの並びに対応する新sprite番号 */
  spriteIndices: number[];
  summary: string;
}

/** 焼き済みのシートとspriteを、`pb`のシートとspriteの後ろへ足した画像セットを組む。 */
export function mergePackedImages(
  pb: IfPackage,
  packed: PackedImages,
): MergedImages {
  const base = pb.metadata.sheets.length;
  const sheets = [
    ...pb.metadata.sheets,
    ...packed.heights.map((height) => ({ height, width: SHEET_WIDTH })),
  ];
  const sprites = [
    ...pb.metadata.sprites,
    ...packed.sprites.map((sprite) => ({
      h: sprite.h,
      w: sprite.w,
      x: sprite.x,
      y: sprite.y + (base + sprite.sheet) * SHEET_STRIDE,
    })),
  ];
  const files = [...pb.files, ...packed.files];
  files[0] = buildImageSetMetadata(pb.files[0], sheets, sprites);
  return {
    get bytes() {
      return buildIfPackage(files);
    },
    // 65枚目以降のシートのyは16bitに収まらないので、files[0]を読み直さない
    package: {
      files,
      metadata: { ...parseMetadata(files[0]), sheets, sprites },
      payloadEnd: 0,
    },
    spriteIndices: packed.sprites.map((_, i) => pb.metadata.sprites.length + i),
    summary:
      `sprites ${pb.metadata.sprites.length}+${packed.sprites.length} sheets ${
        packed.heights.map((h) => `${SHEET_WIDTH}x${h}`).join(",")
      }`,
  };
}
