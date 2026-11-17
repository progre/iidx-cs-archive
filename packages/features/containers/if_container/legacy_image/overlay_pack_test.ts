// 実行: deno test packages/features/containers/if_container/legacy_image/overlay_pack_test.ts
// オーバーレイの矩形と上限と、container.ts の長さ関数を確かめる。

import { assertEquals } from "@std/assert";
import {
  buildIfPackage,
  compressedLengths,
  padToSector,
  SECTOR_BYTES,
} from "../format/mod.ts";
import { fitsSheetLimit, overlayRects } from "./overlay_pack.ts";
import { layoutSheets } from "../title_image_set/mod.ts";

Deno.test("矩形のyはシート番号を1024間隔で含む", () => {
  const layout = layoutSheets([{ h: 4, w: 4 }], 2);
  layout.sprites[0].sheet = 2;
  assertEquals(overlayRects(layout)[0].y, 2 * 1024 + layout.sprites[0].y);
});

Deno.test("sheetが32枚を超えると上限に収まらない", () => {
  assertEquals(fitsSheetLimit(32), true);
  assertEquals(fitsSheetLimit(33), false);
});

Deno.test("セクタ倍数まで0で埋め、記述子の圧縮長とmetadataを読み戻せる", () => {
  const first = new Uint8Array(100).fill(7);
  const bytes = buildIfPackage([first, new Uint8Array(300)]);
  const padded = padToSector(bytes);
  assertEquals(padded.length % SECTOR_BYTES, 0);
  assertEquals(padded.subarray(0, bytes.length), bytes);
  const lengths = compressedLengths(bytes);
  assertEquals(lengths.length, 2);
  assertEquals(lengths.every((n) => n > 0), true);
});
