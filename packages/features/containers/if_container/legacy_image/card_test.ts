// 実行: deno test packages/features/containers/if_container/legacy_image/card_test.ts
// 曲名カードのmetadataを、原盤を読まずに組めることを確かめる。

import { assertEquals } from "@std/assert";
import { cardMetadataOf } from "./card.ts";

Deno.test("曲名カードのmetadataは、sheet1枚・sprite1件・animation1件を持つ", () => {
  const metadata = cardMetadataOf({
    art: { height: 3, width: 5 },
    sheet: { h: 64, w: 128 },
  });
  const view = new DataView(metadata.buffer);
  const spriteTable = view.getUint32(8, true);
  const animationTable = view.getUint32(0x0c, true);
  const animation = view.getUint32(animationTable, true);
  assertEquals(
    [0, 2, 4, 6].map((offset) => view.getUint16(offset, true)),
    [0, 1, 1, 1],
  );
  assertEquals([view.getUint16(0x10, true), view.getUint16(0x12, true)], [
    128,
    64,
  ]);
  assertEquals(
    [0, 2, 4, 6].map((offset) => view.getUint16(spriteTable + offset, true)),
    [0, 0, 5, 3],
  );
  // animationは種類0xFFFFの項目で、基準位置の2倍が640x480の画面になる
  assertEquals(view.getUint16(animation, true), 0xffff);
  assertEquals(
    [
      view.getUint16(animation + 0x10, true),
      view.getUint16(animation + 0x12, true),
    ],
    [320, 240],
  );
});
