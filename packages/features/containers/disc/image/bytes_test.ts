import { assertEquals } from "@std/assert";
import { bytesEqual } from "./bytes.ts";

Deno.test("同じバイト列は等しい", () => {
  assertEquals(bytesEqual(Uint8Array.of(1, 2), Uint8Array.of(1, 2)), true);
});

Deno.test("値が違うか長さが違えば等しくない", () => {
  assertEquals(bytesEqual(Uint8Array.of(1, 2), Uint8Array.of(1, 3)), false);
  assertEquals(bytesEqual(Uint8Array.of(1), Uint8Array.of(1, 2)), false);
});
