// spriteのシルバー化。合成した画素の値とパレットで確かめる。
// 実行: deno test packages/features/containers/if_container/texture/gray_test.ts

import { type IndexedSheet, silverReference, silverSprites } from "./gray.ts";
import { clutIndex, PALETTE_BYTES } from "./texture.ts";

function assertEquals<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: ${String(actual)} != ${String(expected)}`);
  }
}

/** 画素の値が指すパレットの位置へ色を置く */
function paletteOf(colors: Map<number, number[]>): Uint8Array {
  const palette = new Uint8Array(PALETTE_BYTES);
  for (const [value, rgba] of colors) {
    palette.set(rgba, clutIndex(value) * 4);
  }
  return palette;
}

/** 結果の画素の灰色とalphaを"灰色/alpha"で返す */
function pixelsOf(result: { indices: Uint8Array; palette: Uint8Array }) {
  return Array.from(result.indices, (value) => {
    const i = clutIndex(value) * 4;
    const [r, g, b, alpha] = result.palette.subarray(i, i + 4);
    if (r !== g || g !== b) {
      throw new Error(`灰色でない: ${r},${g},${b}`);
    }
    return `${g}/${alpha}`;
  });
}

/** 縁の黒、橙の明るい色・暗い色・中ほどの色 */
const ORANGE = new Map([
  [1, [0, 0, 0, 128]],
  [2, [255, 200, 0, 128]],
  [3, [200, 60, 0, 128]],
  [4, [230, 120, 0, 128]],
]);

/** シルバーの灰色と白 */
const SILVER = new Map([
  [5, [128, 128, 128, 128]],
  [6, [255, 255, 255, 128]],
]);

Deno.test("手本の分布は、もとからシルバーのspriteの塗りだけから作る", () => {
  const sheet: IndexedSheet = {
    indices: Uint8Array.of(1, 5, 6, 1, 2, 3),
    palette: paletteOf(new Map([...ORANGE, ...SILVER])),
    width: 3,
    rects: [{ x: 0, y: 0, w: 3, h: 1 }, { x: 0, y: 1, w: 3, h: 1 }],
  };
  const reference = silverReference([sheet]);
  // 縁の黒と、色付きのspriteの暗い橙(0.49)は含まない
  assertEquals(
    reference.at(0)?.toFixed(3),
    (128 / 255).toFixed(3),
    "最も暗い値",
  );
  assertEquals(reference.at(-1), 1, "最も明るい値");
});

Deno.test("塗りの明るさの順位を手本の同じ順位の値にし、縁とalphaは残す", () => {
  const sheet: IndexedSheet = {
    indices: Uint8Array.of(1, 2, 3, 4),
    palette: paletteOf(ORANGE),
    width: 4,
    rects: [{ x: 0, y: 0, w: 4, h: 1 }],
  };
  // 塗りの3画素は、暗い順に手本の0・0.5・1の位置の値になる
  const result = silverSprites(sheet, [0.4, 0.7, 1]);
  assertEquals(
    pixelsOf(result).join(" "),
    "0/128 255/128 102/128 179/128",
    "画素",
  );
});

Deno.test("矩形の外は輝度の灰色にし、画素の値はCLUTの並び替えを通して引く", () => {
  const sheet: IndexedSheet = {
    indices: Uint8Array.of(8),
    palette: paletteOf(
      new Map([[8, [100, 100, 100, 128]], [16, [255, 0, 0, 128]]]),
    ),
    width: 1,
    rects: [],
  };
  assertEquals(
    pixelsOf(silverSprites(sheet, [1])).join(" "),
    "100/128",
    "画素",
  );
});

Deno.test("灰色とalphaの組が256を超えたら、灰色の段階を粗くして収める", () => {
  // 1行目は矩形の外で256段の灰色、2行目は手本の値へ置き換わり別の灰色になる
  const palette = paletteOf(
    new Map(
      Array.from({ length: 256 }, (_, v) => {
        const gray = clutIndex(v);
        return [v, [gray, gray, gray, 128]];
      }),
    ),
  );
  const row = Array.from({ length: 256 }, (_, v) => v);
  const sheet: IndexedSheet = {
    indices: Uint8Array.from([...row, ...row]),
    palette,
    width: 256,
    rects: [{ x: 0, y: 1, w: 256, h: 1 }],
  };
  const reference = Array.from(
    { length: 256 },
    (_, k) => 0.5 + k / 510 + 0.001,
  );
  const pixels = pixelsOf(silverSprites(sheet, reference));
  assertEquals(new Set(pixels).size <= 256, true, "色の数");
  assertEquals(pixels.at(0), "0/128", "最も暗い画素");
});
