// 実行: deno test packages/features/contents/display/pixels/quantize_test.ts
// 色の数え方と色表の組み方を確かめる。

import { assertEquals } from "@std/assert";
import { colorKey, countColors, quantize } from "./quantize.ts";

const solid = (colors: number[][]) => ({
  height: 1,
  rgba: new Uint8Array(colors.flat()),
  width: colors.length,
});

Deno.test("透過の画素は数えず、同じ色は合算する", () => {
  const image = solid([[1, 2, 3, 255], [1, 2, 3, 255], [9, 9, 9, 0]]);
  const counts = countColors([image]);
  assertEquals(counts.size, 1);
  assertEquals(counts.get(colorKey(image.rgba, 0)), 2);
});

Deno.test("255色に収まる絵は、色ごとにindexを1から振る", () => {
  const image = solid([[10, 20, 30, 255], [40, 50, 60, 128]]);
  const { colors, indexOf } = quantize(countColors([image]));
  const indices = [colorKey(image.rgba, 0), colorKey(image.rgba, 4)].map((k) =>
    indexOf.get(k)!
  );
  assertEquals(new Set(indices).size, 2);
  assertEquals(colors[indices[0] - 1], [10, 20, 30, 255]);
  assertEquals(colors[indices[1] - 1], [40, 50, 60, 128]);
});

Deno.test("255色を超える絵は、255色以内にまとめても全ての色にindexが付く", () => {
  const colors = Array.from(
    { length: 600 },
    (_, i) => [i % 256, (i * 7) % 256, (i * 13) % 256, 255],
  );
  const image = solid(colors);
  const result = quantize(countColors([image]));
  const used = new Set(result.indexOf.values());
  assertEquals(used.size <= 255, true);
  assertEquals(result.colors.length <= 255, true);
  assertEquals(used.has(0), false);
  colors.forEach((_, i) => {
    assertEquals(result.indexOf.has(colorKey(image.rgba, i * 4)), true);
  });
});
