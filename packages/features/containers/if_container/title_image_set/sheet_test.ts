// 実行: deno test packages/features/containers/if_container/legacy_image/sheet_test.ts
// シートの置き場所と、色表の並べ方と、texture fileへの焼き込みを確かめる。

import { assertEquals } from "@std/assert";
import { clutIndex, decodeTexture8 } from "../texture/mod.ts";
import { encodePalette } from "./sheet.ts";
import { encodeSheet, layoutSheets } from "./sheet.ts";

Deno.test("余白を取って置くと矩形は離れ、入力の並びで添字を引ける", () => {
  const padding = 2;
  const layout = layoutSheets([{ h: 2, w: 3 }, { h: 3, w: 2 }], padding);
  const [wide, tall] = layout.sprites;
  assertEquals(wide.x >= padding && wide.y >= padding, true, "左上に余白");
  assertEquals(layout.members, [[0, 1]]);
  const [left, right] = [wide, tall].sort((a, b) => a.x - b.x);
  assertEquals(
    right.x >= left.x + left.w + padding * 2,
    true,
    "矩形の間に余白",
  );
  assertEquals(layout.width, 640);
  assertEquals(layout.heights.length, 1);
});

Deno.test("色表はindex 8〜15と16〜23を入れ替え、alphaを0..0x80へ縮める", () => {
  const colors = Array.from({ length: 10 }, (_, i) => [i, i + 1, i + 2, 255]);
  colors[0][3] = 0;
  const palette = encodePalette(colors);
  const slot = (
    index: number,
  ) => [...palette.subarray(clutIndex(index) * 4, clutIndex(index) * 4 + 4)];
  assertEquals(slot(1), [0, 1, 2, 0]);
  assertEquals(slot(9), [8, 9, 10, 128]);
  assertEquals(clutIndex(9), 17);
});

Deno.test("焼いたtextureを読み戻すと、置いた色に戻る", () => {
  const width = 128;
  const height = 64;
  const indices = new Uint8Array(width * height);
  indices[0] = 1;
  indices[1] = 2;
  const file = encodeSheet(
    indices,
    [[255, 0, 0, 255], [0, 0, 255, 255]],
    width,
    height,
  );
  const rgba = decodeTexture8(file, width, height);
  assertEquals([...rgba.subarray(0, 4)], [255, 0, 0, 255]);
  assertEquals([...rgba.subarray(4, 8)], [0, 0, 255, 255]);
  assertEquals(rgba[11], 0, "index 0は透過");
});
