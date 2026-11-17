import { assertEquals } from "@std/assert";
import { chartKeyFrom, readKeyParts } from "../lz_store/mod.ts";

const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

Deno.test("readKeyPartsは、位置にあるNUL終端の文字列を読む", () => {
  const elf = new TextEncoder().encode("xx\0abc\0\0defg\0z");
  assertEquals(readKeyParts(elf, [3, 8, 0]), ["abc", "defg", "xx"]);
});

Deno.test("chartKeyFromは、文字列から1文字ずつ拾い、実行ファイルの位置の文字をはさむ", () => {
  const elf = new TextEncoder().encode("-!");
  const parts = ["alpha", "beta", "gamma"];
  const key = chartKeyFrom(elf, parts, [[0, 4], 0, [2, 0], [1, 1], 1]);
  assertEquals(text(key), "a-ge!");
});
