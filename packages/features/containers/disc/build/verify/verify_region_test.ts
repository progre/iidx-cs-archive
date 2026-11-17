import { assertEquals, assertRejects } from "@std/assert";
import { type DiscImage, SEC } from "@csa/core";
import type { ImageInput } from "../image_input.ts";
import { verifySourceRegion } from "./verify_region.ts";

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

const input = {
  plan: { reused: [{ lba: 1, sourceSize: 10 }] },
  sourcePatches: [{ offset: 5, replacement: Uint8Array.of(1, 2, 3) }],
  sourceVolumeSectors: 2,
} as unknown as ImageInput;

function windowsRecorder() {
  const calls: unknown[] = [];
  return {
    calls,
    windows: {
      untouchedWindows: (bytes: number, rewritten: unknown) => {
        calls.push([bytes, rewritten]);
        return [0, 4];
      },
      windowBytes: 4,
    },
  };
}

Deno.test("書き換えた範囲を渡し、比べた窓の数を返す", async () => {
  const bytes = new Uint8Array(2 * SEC);
  const { calls, windows } = windowsRecorder();
  const count = await verifySourceRegion(
    imageOf(bytes),
    imageOf(bytes),
    input,
    [{ offset: 100, bytes: Uint8Array.of(7) }],
    windows,
  );
  assertEquals(count, 2);
  assertEquals(calls, [[2 * SEC, [[100, 101], [5, 8], [SEC, SEC + 10]]]]);
});

Deno.test("窓の中身が違えば、位置を添えて例外にする", async () => {
  const same = new Uint8Array(2 * SEC);
  const changed = same.slice();
  changed[5] = 1;
  await assertRejects(
    () =>
      verifySourceRegion(
        imageOf(changed),
        imageOf(same),
        input,
        [],
        windowsRecorder().windows,
      ),
    Error,
    "原盤領域が0x4で書き換わっている",
  );
});
