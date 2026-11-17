// 曲名カードの絵を、sheetの左上から始まる置き方へ並べ直す判断。
// 実行: deno test packages/features/containers/if_container/title_card/sprite_sheets_test.ts

import { assertEquals } from "@std/assert";
import { buildIfPackage, parseIfPackage } from "../format/mod.ts";
import { imageSetOf } from "../image_set/mod.ts";
import { decodeIndices8 } from "../texture/mod.ts";
import { withSpritesAtSheetOrigin } from "./sprite_sheets.ts";

const bytesOf = (pkg: ReturnType<typeof imageSetOf>) =>
  buildIfPackage(pkg.files);

Deno.test("同じsheetに横に並んだ2枚目の絵は、2枚目のsheetの左上へ移す", () => {
  const source = imageSetOf(
    [{ h: 2, w: 2, x: 0, y: 0 }, { h: 2, w: 2, x: 298, y: 0 }],
    [
      { values: [1, 2], x: 0, y: 0 },
      { values: [3, 4], x: 0, y: 1 },
      { values: [5, 6], x: 298, y: 0 },
      { values: [7, 8], x: 298, y: 1 },
    ],
  );
  const bytes = withSpritesAtSheetOrigin(bytesOf(source))!;
  assertEquals(bytes.length % 2048, 0);
  const moved = parseIfPackage(bytes);
  const { sheets, sprites } = moved.metadata;
  assertEquals(sprites, [
    { h: 2, w: 2, x: 0, y: 0 },
    { h: 2, w: 2, x: 0, y: 1024 },
  ]);
  assertEquals(sheets, [
    { height: 128, width: 128 },
    { height: 128, width: 128 },
  ]);
  const second = decodeIndices8(moved.files[2], 128, 128).indices;
  assertEquals([...second.subarray(0, 2), ...second.subarray(128, 130)], [
    5,
    6,
    7,
    8,
  ]);
});

Deno.test("どの絵もsheetの左上から始まるカードは、並べ直さない", () => {
  const source = imageSetOf([{ h: 2, w: 2, x: 0, y: 0 }], []);
  assertEquals(withSpritesAtSheetOrigin(bytesOf(source)), null);
});
