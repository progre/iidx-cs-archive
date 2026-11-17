// PB形式の`.if`を展開し、sheetのPNGと、sprite・animationの表のJSONを書く。

import {
  decodeTexture8,
  normalizeIfDescriptors,
  PALETTE_BYTES,
  parseAnimations,
  parseIfPackage,
} from "@csa/containers-if-container";
import type { DescriptorStart } from "@csa/core";
import { writeJson, writePng } from "./if_files.ts";

/** 足りなければゼロで埋め、余れば切り捨てて、寸法どおりの長さにする */
function fitTexture(
  file: Uint8Array | undefined,
  width: number,
  height: number,
): Uint8Array {
  const fitted = new Uint8Array(PALETTE_BYTES + width * height);
  fitted.set((file ?? new Uint8Array()).subarray(0, fitted.length));
  return fitted;
}

/**
 * 原盤には寸法とtexture長が合わないsheetがある。
 * 警告を出し、長さを合わせて崩れたまま復号する
 */
function decodeSheet(
  dir: string,
  index: number,
  file: Uint8Array | undefined,
  width: number,
  height: number,
): Uint8Array {
  try {
    return decodeTexture8(file ?? new Uint8Array(), width, height);
  } catch (cause) {
    console.warn(`${dir} sheet${index}: ${cause}`);
    return decodeTexture8(fitTexture(file, width, height), width, height);
  }
}

export async function expandIf(
  dir: string,
  bytes: Uint8Array,
  descriptorStart: DescriptorStart,
) {
  const pkg = parseIfPackage(normalizeIfDescriptors(bytes, descriptorStart));
  const { sheets, sprites } = pkg.metadata;
  const animations = parseAnimations(pkg.files[0]);
  await Deno.mkdir(dir, { recursive: true });
  for (const [i, { height, width }] of sheets.entries()) {
    const rgba = decodeSheet(dir, i, pkg.files[i + 1], width, height);
    await writePng(dir, `sheet${i}`, { height, rgba, width });
  }
  await writeJson(dir, "metadata", { sheets, sprites, animations });
}
