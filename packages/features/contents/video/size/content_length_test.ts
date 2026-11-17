import { assertEquals } from "@std/assert";
import { contentLength } from "./buffer_fit.ts";

const readerOf = (bytes: Uint8Array) => (offset: number, length: number) =>
  Promise.resolve(bytes.subarray(offset, offset + length));

Deno.test("末尾のゼロを除いた長さを返す", async () => {
  const bytes = new Uint8Array([1, 2, 0, 3, 0, 0, 0]);
  assertEquals(await contentLength(bytes.length, readerOf(bytes)), 4);
});

Deno.test("埋めたゼロが一度に読む長さより長くても、手前まで戻って探す", async () => {
  const bytes = new Uint8Array(200 * 1024);
  bytes[10] = 5;
  assertEquals(await contentLength(bytes.length, readerOf(bytes)), 11);
});

Deno.test("全部がゼロなら0を返す", async () => {
  const bytes = new Uint8Array(16);
  assertEquals(await contentLength(bytes.length, readerOf(bytes)), 0);
});
