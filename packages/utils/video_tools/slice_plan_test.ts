// 実行: deno test packages/utils/video_tools/slice_plan_test.ts

import { assertEquals, assertThrows } from "@std/assert";
import { assertSliceInRange, sliceChunks } from "./slice_iso_file.ts";

Deno.test("切り出しは、端数を最後の1回にまとめて分ける", () => {
  assertEquals(sliceChunks(10, 4), [
    { length: 4, offset: 0 },
    { length: 4, offset: 4 },
    { length: 2, offset: 8 },
  ]);
  assertEquals(sliceChunks(8, 4).length, 2);
  assertEquals(sliceChunks(0, 4), []);
});

Deno.test("アーカイブの終わりを超える範囲は拒む", () => {
  assertSliceInRange("X.DAT", 10, 6, 4);
  assertThrows(() => assertSliceInRange("X.DAT", 10, 6, 5), Error, "範囲外");
});
