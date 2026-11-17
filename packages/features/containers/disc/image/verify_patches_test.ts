import { assertRejects } from "@std/assert";
import type { DiscImage } from "@csa/core";
import { verifySourcePatches } from "./verify_patches.ts";

const imageOf = (bytes: Uint8Array): DiscImage => ({
  size: bytes.length,
  readAt: (offset, length) =>
    Promise.resolve(bytes.slice(offset, offset + length)),
  readInto: (offset, buffer) => {
    buffer.set(bytes.subarray(offset, offset + buffer.length));
    return Promise.resolve();
  },
  close: () => {},
  [Symbol.dispose]: () => {},
});

const PATCH = { name: "IOP", offset: 2, replacement: Uint8Array.of(7, 8) };

Deno.test("差し替えた内容が読み戻せれば通る", async () => {
  await verifySourcePatches(imageOf(Uint8Array.of(0, 0, 7, 8, 0)), [PATCH]);
});

Deno.test("読み戻せない箇所は、名前を示して例外にする", async () => {
  await assertRejects(
    () => verifySourcePatches(imageOf(Uint8Array.of(0, 0, 7, 9, 0)), [PATCH]),
    Error,
    "IOPが読み戻せない",
  );
});
