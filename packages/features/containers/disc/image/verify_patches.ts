// 書き終えたイメージに、差し替えた内容が読み戻せるかを調べる。

import type { DiscImage } from "@csa/core";
import { bytesEqual } from "./bytes.ts";
import { readExact } from "./read.ts";

/** 差し替えた箇所。`replacement`が`offset`から書いてあるはずである */
export interface ReplacedRange {
  name: string;
  offset: number;
  replacement: Uint8Array;
}

export async function verifySourcePatches(
  image: DiscImage,
  patches: readonly ReplacedRange[],
): Promise<void> {
  for (const patch of patches) {
    const actual = new Uint8Array(patch.replacement.length);
    await readExact(image, patch.offset, actual);
    if (!bytesEqual(actual, patch.replacement)) {
      throw new Error(`${patch.name}が読み戻せない`);
    }
  }
}
