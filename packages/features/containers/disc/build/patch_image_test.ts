import { assertEquals, assertRejects } from "@std/assert";
import type { DiscImage } from "@csa/core";
import type { ImageSink } from "../image/mod.ts";
import { applySourcePatches } from "./patch_image.ts";

const imageOf = (bytes: Uint8Array): DiscImage => ({
  size: bytes.length,
  readAt: (offset, length) =>
    Promise.resolve(bytes.slice(offset, offset + length)),
  readInto: () => Promise.resolve(),
  close: () => {},
  [Symbol.dispose]: () => {},
});

function sinkOf(): { sink: ImageSink; writes: [number, number[]][] } {
  const writes: [number, number[]][] = [];
  let position = 0;
  const sink = {
    seek: (offset: number) => {
      position = offset;
      return Promise.resolve();
    },
    write: (data: Uint8Array) => {
      writes.push([position, [...data]]);
      return Promise.resolve();
    },
  } as unknown as ImageSink;
  return { sink, writes };
}

const PATCH = {
  expected: Uint8Array.of(1, 2),
  name: "p",
  offset: 1,
  replacement: Uint8Array.of(9, 9),
};

Deno.test("原盤の語列が想定どおりなら、差し替えを書く", async () => {
  const { sink, writes } = sinkOf();
  await applySourcePatches(imageOf(Uint8Array.of(0, 1, 2, 3)), sink, [PATCH]);
  assertEquals(writes, [[1, [9, 9]]]);
});

Deno.test("原盤の語列が違えば、書かずに例外にする", async () => {
  const { sink, writes } = sinkOf();
  await assertRejects(
    () => applySourcePatches(imageOf(Uint8Array.of(0, 1, 7, 3)), sink, [PATCH]),
    Error,
    "想定の語列でない",
  );
  assertEquals(writes, []);
});
