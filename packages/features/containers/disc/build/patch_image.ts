// 書き終えたイメージの一部を差し替える。ISO9660の値と原盤の差し替え(`SourcePatchRange`)が使う。

import type { DiscImage } from "@csa/core";
import { bytesEqual, type ImageSink } from "../image/mod.ts";
import type { SourcePatchRange } from "./image_input.ts";

export async function patchAt(
  sink: ImageSink,
  offset: number,
  data: Uint8Array,
): Promise<void> {
  await sink.seek(offset);
  await sink.write(data);
}

export async function applySourcePatches(
  source: DiscImage,
  output: ImageSink,
  patches: readonly SourcePatchRange[],
): Promise<void> {
  for (const patch of patches) {
    const actual = await source.readAt(patch.offset, patch.expected.length);
    if (!bytesEqual(actual, patch.expected)) {
      throw new Error(`${patch.name}: 原盤の${patch.offset}が想定の語列でない`);
    }
    await patchAt(output, patch.offset, patch.replacement);
  }
}
