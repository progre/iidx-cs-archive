// 原盤領域の読み戻し。差し替えた箇所は差し替え後の値と比べ、
// それ以外は原盤と同じかを抜き取りの窓で比べる。

import { type DiscImage, SEC } from "@csa/core";
import { sameRange } from "../../image/mod.ts";
import type { ByteWrite } from "../../volume/mod.ts";
import type { ImageInput } from "../image_input.ts";

/** 抜き取りの窓の決め方。窓の選び方は配置計画の側が持つ */
export interface RegionWindows {
  /** 書き換えた範囲(`[開始, 終了)`)に掛からない窓の開始位置 */
  untouchedWindows: (
    regionBytes: number,
    rewritten: readonly (readonly [number, number])[],
  ) => number[];
  windowBytes: number;
}

/** 書き換えた範囲に掛かる窓は飛ばす。比べた窓の数を返す */
export async function verifySourceRegion(
  image: DiscImage,
  source: DiscImage,
  input: ImageInput,
  metadataWrites: readonly ByteWrite[],
  windows: RegionWindows,
): Promise<number> {
  const rewritten = [
    ...metadataWrites.map(({ offset, bytes }) =>
      [offset, offset + bytes.length] as const
    ),
    ...input.sourcePatches.map(({ offset, replacement }) =>
      [offset, offset + replacement.length] as const
    ),
    // 空いた領域へ置いた資産は、資産の読み戻しが素材と突き合わせる
    ...input.plan.reused.map(({ lba, sourceSize }) =>
      [lba * SEC, lba * SEC + sourceSize] as const
    ),
  ];
  const offsets = windows.untouchedWindows(
    input.sourceVolumeSectors * SEC,
    rewritten,
  );
  for (const offset of offsets) {
    if (!await sameRange(image, offset, source, offset, windows.windowBytes)) {
      throw new Error(`原盤領域が0x${offset.toString(16)}で書き換わっている`);
    }
  }
  return offsets.length;
}
