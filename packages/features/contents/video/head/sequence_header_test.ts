import { assertEquals } from "@std/assert";
import { findSequenceHeader } from "./video_probes.ts";

Deno.test("findSequenceHeader: 最初のsequence_headerの位置と解像度を返す", () => {
  const bytes = new Uint8Array(32);
  bytes.set([0, 0, 1, 0xb3, 0x14, 0x00, 0xf0], 5);
  assertEquals(findSequenceHeader(bytes), {
    offset: 5,
    width: 320,
    height: 240,
  });
});

Deno.test("findSequenceHeader: 無ければnullを返す", () => {
  assertEquals(findSequenceHeader(new Uint8Array(32)), null);
});
