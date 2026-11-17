// 実行: deno test packages/features/contents/display/legacy/compose_test.ts
// 見た目が同じ絵をまとめる鍵を確かめる。

import { assertEquals } from "@std/assert";
import { imageKey, sameImage } from "./compose.ts";

const image = (value: number) => ({
  height: 1,
  rgba: new Uint8Array([value, 0, 0, 255]),
  width: 1,
});

Deno.test("同じ画素の絵は同じ鍵で、違う画素の絵は違う鍵になる", () => {
  assertEquals(imageKey(image(1)), imageKey(image(1)));
  assertEquals(imageKey(image(1)) === imageKey(image(2)), false);
  assertEquals(sameImage(image(1), image(1)), true);
  assertEquals(sameImage(image(1), image(2)), false);
});
