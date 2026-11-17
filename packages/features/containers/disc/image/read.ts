// 読み戻し検査が使う読み出し。

import type { DiscImage } from "@csa/core";
import { bytesEqual } from "./bytes.ts";

const CHUNK = 16 * 1024 * 1024;

export async function readExact(
  image: DiscImage,
  offset: number,
  buffer: Uint8Array,
): Promise<void> {
  await image.readInto(offset, buffer);
}

export async function sameRange(
  left: DiscImage,
  leftOffset: number,
  right: DiscImage,
  rightOffset: number,
  length: number,
): Promise<boolean> {
  const a = new Uint8Array(Math.min(CHUNK, length));
  const b = new Uint8Array(a.length);
  for (let done = 0; done < length;) {
    const want = Math.min(a.length, length - done);
    await readExact(left, leftOffset + done, a.subarray(0, want));
    await readExact(right, rightOffset + done, b.subarray(0, want));
    if (!bytesEqual(a.subarray(0, want), b.subarray(0, want))) {
      return false;
    }
    done += want;
  }
  return true;
}
