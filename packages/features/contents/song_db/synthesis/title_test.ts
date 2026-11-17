// 頭文字フォルダーの判定と題名欄の文字列を作る処理(title.ts)を、
// テストの中で組み立てたエントリとプレースホルダーの文字列で確かめる。原盤は読まない。
import { assertEquals, assertThrows } from "@std/assert";
import { PB_FORMAT } from "../pb/mod.ts";
import { hasNameFolderInitial, pbTitleOf } from "./title.ts";

const recordWithTitle = (title: string) => {
  const record = PB_FORMAT.recordOf(new Uint8Array(PB_FORMAT.size));
  record.title.text = title;
  return record;
};

Deno.test("大文字の英字で始まる題名は頭文字フォルダーに入る", () => {
  assertEquals(hasNameFolderInitial(recordWithTitle("TEST")), true);
});

Deno.test("英字以外で始まる題名は頭文字フォルダーに入らない", () => {
  assertEquals(hasNameFolderInitial(recordWithTitle("20XX")), false);
  assertEquals(hasNameFolderInitial(recordWithTitle("test")), false);
  assertEquals(hasNameFolderInitial(recordWithTitle("")), false);
});

Deno.test("題名は大文字にそろう", () => {
  assertEquals(pbTitleOf("test song", false), "TEST SONG");
});

Deno.test("ASCIIの印字可能文字以外は切り詰める", () => {
  assertEquals(pbTitleOf("aあb\tc", false), "ABC");
});

Deno.test("USの前置き符丁と末尾空白を落とす", () => {
  assertEquals(pbTitleOf("12 003_hello world  ", true), "HELLO WORLD");
});

Deno.test("前置き符丁を持たない世代は数字で始まる題名をそのまま残す", () => {
  assertEquals(pbTitleOf("12 003_x", false), "12 003_X");
});

Deno.test("NUL終端が枠に収まらない題名を書くと、エラーになる", () => {
  const title = pbTitleOf("a".repeat(0x40), false);
  assertThrows(() => recordWithTitle(title));
});
