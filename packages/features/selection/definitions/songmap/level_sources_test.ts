import { assertEquals } from "@std/assert";
import { levelSourcesOf } from "./level_sources.ts";

Deno.test("レベル欄を持たない難易度は、代わりの難易度のレベル欄を読む", () => {
  const levels = levelSourcesOf("3rd");
  assertEquals(levels.sp_beginner, levels.sp_normal);
  assertEquals(levels.sp_another, levels.sp_hyper);
  assertEquals(levels.sp_black, levels.sp_hyper);
});

Deno.test("初心者の欄を別に持つ世代は、その欄を読む", () => {
  assertEquals(levelSourcesOf("red").sp_beginner, "beginner");
});

Deno.test("5th〜8thは未確認の初心者の欄を読み、6th〜8thはBLACKを持たない", () => {
  assertEquals(levelSourcesOf("5th").sp_beginner, 4);
  assertEquals("sp_black" in levelSourcesOf("5th"), true);
  assertEquals("sp_black" in levelSourcesOf("6th"), false);
});

Deno.test("djt〜pbのDP BEGINNERはDP NORMALの欄を読み、DP BLACKはDP ANOTHERの欄を読む", () => {
  const levels = levelSourcesOf("pb");
  assertEquals(levels.dp_beginner, levels.dp_normal);
  assertEquals(levels.dp_black, levels.dp_another);
});
