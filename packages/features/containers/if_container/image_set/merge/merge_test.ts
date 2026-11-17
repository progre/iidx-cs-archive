// 画像セットへのspriteの追加。合成した画像セットだけで確かめ、原盤は読まない。
// 実行: deno test packages/features/containers/if_container/image_set/merge_test.ts

import { parseIfPackage } from "../../format/mod.ts";
import {
  decodeIndices8,
  encodeTexture8,
  PALETTE_BYTES,
} from "../../texture/mod.ts";
import {
  extractSprites,
  parseExtractedSprites,
  serializeExtractedSprites,
  SHEET_WIDTH,
} from "../sprites/mod.ts";
import {
  mergeExtractedSprites,
  mergeImageSet,
  silverReferenceOf,
} from "./merge_image_set.ts";
import { mergePackedImages } from "./merge_packed.ts";
import { imageSetOf, paletteOf, SHEET_HEIGHT } from "../testing.ts";

function assertEquals<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: ${String(actual)} != ${String(expected)}`);
  }
}

const PB_SPRITE = { h: 1, w: 2, x: 0, y: 0 };

Deno.test("焼き済みのシートは、既存のシートとspriteの後ろへ足し、既存のspriteを動かさない", () => {
  const pb = imageSetOf([PB_SPRITE], [{ x: 0, y: 0, values: [1, 2] }]);
  const texture = encodeTexture8(
    new Uint8Array(SHEET_WIDTH * SHEET_HEIGHT),
    new Uint8Array(PALETTE_BYTES),
    SHEET_WIDTH,
    SHEET_HEIGHT,
  );
  const merged = mergePackedImages(pb, {
    files: [texture],
    heights: [SHEET_HEIGHT],
    sprites: [{ h: 9, sheet: 0, w: 7, x: 3, y: 5 }],
  });
  const rebuilt = parseIfPackage(merged.bytes);
  assertEquals(rebuilt.metadata.sheets.length, 2, "シート数");
  assertEquals(rebuilt.metadata.sprites.length, 2, "sprite数");
  assertEquals(
    JSON.stringify(rebuilt.metadata.sprites[0]),
    JSON.stringify(PB_SPRITE),
    "既存sprite",
  );
  assertEquals(
    JSON.stringify(rebuilt.metadata.sprites[1]),
    JSON.stringify({ h: 9, w: 7, x: 3, y: 5 + 1024 }),
    "足したsprite",
  );
  assertEquals(JSON.stringify(merged.spriteIndices), "[1]", "新sprite番号");
});

Deno.test("65枚目以降のシートのspriteも、yを16bitに切り詰めず保持する", () => {
  const pb = imageSetOf([PB_SPRITE], [{ x: 0, y: 0, values: [1, 2] }]);
  const merged = mergePackedImages(pb, {
    files: Array.from({ length: 64 }, () => new Uint8Array()),
    heights: Array.from({ length: 64 }, () => SHEET_HEIGHT),
    sprites: [{ h: 9, sheet: 63, w: 7, x: 3, y: 5 }],
  });
  assertEquals(merged.package.metadata.sprites[1].y, 64 * 1024 + 5, "y");
});

Deno.test("素材のspriteは、重複を除いて新しいシートへ写し、画素を保つ", () => {
  const pb = imageSetOf([PB_SPRITE], [{ x: 0, y: 0, values: [1, 2] }]);
  const source = imageSetOf(
    [{ h: 2, w: 3, x: 10, y: 20 }],
    [{ x: 10, y: 20, values: [4, 5, 6] }, { x: 10, y: 21, values: [7, 8, 9] }],
  );
  const merged = mergeImageSet(pb, source, [0, 0], null);
  assertEquals(merged.spriteMap.get(0), 1, "新sprite番号");
  const rebuilt = parseIfPackage(merged.bytes);
  const sprite = rebuilt.metadata.sprites[1];
  assertEquals(Math.floor(sprite.y / 1024), 1, "新しいシートに置かれる");
  const sheet = decodeIndices8(rebuilt.files[2], SHEET_WIDTH, SHEET_HEIGHT);
  const top = (sprite.y % 1024) * SHEET_WIDTH + sprite.x;
  assertEquals(
    JSON.stringify(Array.from(sheet.indices.subarray(top, top + 3))),
    "[4,5,6]",
    "1行目",
  );
  const next = top + SHEET_WIDTH;
  assertEquals(
    JSON.stringify(Array.from(sheet.indices.subarray(next, next + 3))),
    "[7,8,9]",
    "2行目",
  );
});

Deno.test("素材に無いspriteを求めると例外になる", () => {
  const pb = imageSetOf([PB_SPRITE], []);
  const source = imageSetOf([], []);
  let threw = false;
  try {
    mergeImageSet(pb, source, [3], null);
  } catch {
    threw = true;
  }
  assertEquals(threw, true, "例外");
});

Deno.test("シルバーの手本は、もとからシルバーのspriteの明るさの分布になる", () => {
  const palette = paletteOf(
    new Map([[5, [128, 128, 128, 128]], [6, [255, 255, 255, 128]]]),
  );
  const pb = imageSetOf(
    [{ h: 1, w: 2, x: 0, y: 0 }],
    [{ x: 0, y: 0, values: [5, 6] }],
    palette,
  );
  const reference = silverReferenceOf(pb);
  assertEquals(reference.at(0)?.toFixed(3), (128 / 255).toFixed(3), "最小");
  assertEquals(reference.at(-1)?.toFixed(3), "1.000", "最大");
});

Deno.test("取り出したspriteから足した結果は、画像セット全体から足した結果と同じバイト列になる", () => {
  const colors = new Map([
    [1, [10, 20, 30, 128]],
    [5, [128, 128, 128, 128]],
    [6, [255, 255, 255, 128]],
  ]);
  const pb = imageSetOf(
    [{ h: 1, w: 2, x: 0, y: 0 }],
    [{ x: 0, y: 0, values: [5, 6] }],
    paletteOf(colors),
  );
  const source = imageSetOf(
    [
      { h: 2, w: 3, x: 10, y: 20 },
      { h: 1, w: 4, x: 30, y: 5 },
      { h: 1, w: 2, x: 0, y: 40 },
    ],
    [
      { x: 10, y: 20, values: [1, 5, 6] },
      { x: 10, y: 21, values: [6, 5, 1] },
      { x: 30, y: 5, values: [1, 1, 5, 6] },
      { x: 0, y: 40, values: [5, 5] },
    ],
    paletteOf(colors),
    2,
  );
  const needed = [2, 0, 0];
  const silver = silverReferenceOf(pb);
  // 周回では、候補の曲が使うspriteを広めに取り出す。足すのはその一部である
  const file = serializeExtractedSprites(extractSprites(source, [0, 1, 2]));
  for (const reference of [null, silver]) {
    const whole = mergeImageSet(pb, source, needed, reference);
    const extracted = mergeExtractedSprites(
      pb,
      parseExtractedSprites(file),
      needed,
      reference,
    );
    assertEquals(
      JSON.stringify(Array.from(extracted.bytes)),
      JSON.stringify(Array.from(whole.bytes)),
      "バイト列",
    );
    assertEquals(
      JSON.stringify([...extracted.spriteMap]),
      JSON.stringify([...whole.spriteMap]),
      "sprite番号の対応",
    );
    assertEquals(extracted.summary, whole.summary, "要約");
  }
});

Deno.test("取り出していないspriteを求めると例外になる", () => {
  const pb = imageSetOf([PB_SPRITE], []);
  const source = imageSetOf([{ h: 1, w: 1, x: 0, y: 0 }], []);
  const extracted = extractSprites(source, [0]);
  let threw = false;
  try {
    mergeExtractedSprites(pb, extracted, [1], null);
  } catch {
    threw = true;
  }
  assertEquals(threw, true, "例外");
});
