// 実行: deno test packages/features/contents/display/pixels/sheet_indices_test.ts
// 絵をシートの画素indexへ置く規則を確かめる。

import { assertEquals } from "@std/assert";
import { indexCard } from "./card.ts";
import { indexSheet } from "./sheet_indices.ts";

const solid = (width: number, height: number, color: number[]) => ({
  height,
  rgba: new Uint8Array(width * height * 4).map((_, i) => color[i % 4]),
  width,
});

const SHEET = { h: 16, w: 16 };

Deno.test("余白には端の画素が写り、余白の外は透過のままになる", () => {
  const padding = 2;
  const sheet = indexSheet(
    [{ image: solid(3, 2, [255, 0, 0, 255]), x: 4, y: 4 }],
    padding,
    SHEET.w,
    SHEET.h,
  );
  const at = (x: number, y: number) => sheet.indices[y * SHEET.w + x];
  const red = at(4, 4);
  assertEquals(red > 0, true, "絵の画素");
  assertEquals(sheet.colors[red - 1], [255, 0, 0, 255]);
  assertEquals(at(4 - padding, 4 - padding), red, "左上の余白");
  assertEquals(at(4 + 3 + 1, 4 + 2 + 1), red, "右下の余白");
  assertEquals(at(4 + 3 + padding, 4), 0, "余白の外");
});

Deno.test("透明な画素は0のまま、色数が少なければ元の色に戻せる", () => {
  const image = {
    height: 1,
    rgba: new Uint8Array([1, 2, 3, 255, 9, 9, 9, 0, 4, 5, 6, 255]),
    width: 3,
  };
  const sheet = indexSheet([{ image, x: 0, y: 0 }], 0, 4, 1);
  assertEquals(sheet.indices[1], 0);
  assertEquals(sheet.colors[sheet.indices[0] - 1], [1, 2, 3, 255]);
  assertEquals(sheet.colors[sheet.indices[2] - 1], [4, 5, 6, 255]);
});

Deno.test("曲名カードのsheetは128×64の倍数へ切り上げ、絵を左上に置く", () => {
  const card = indexCard(solid(130, 65, [0, 255, 0, 255]));
  assertEquals(card.sheet, { h: 128, w: 256 });
  assertEquals(card.indices.length, 256 * 128);
  assertEquals(card.indices[0] > 0, true);
  assertEquals(card.indices[130], 0, "絵の外");
});
