// 周回で書いた`.if`の整理。
// 実行: deno test packages/features/layout/display_prepare/lap/after_laps_test.ts

import { assertEquals } from "@std/assert";
import { unusedFiles } from "./after_laps.ts";

Deno.test("周回で書いて、最終に使わないファイルだけを返す", () => {
  const laps = [{ files: ["a", "b"] }, { files: ["b", "c"] }];
  assertEquals(unusedFiles(laps, ["a", "c"]), ["b"]);
  assertEquals(unusedFiles(laps, ["a", "b", "c", "d"]), []);
});
