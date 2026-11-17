import { assertEquals, assertThrows } from "@std/assert";
import { describePss } from "./describe_pss.ts";

/** 合成したPSS。パックヘッダー、sequence_header、終端コードだけを並べる */
function syntheticPss(): Uint8Array {
  const bytes = new Uint8Array(32);
  bytes.set([0, 0, 1, 0xba]);
  bytes.set([0, 0, 1, 0xb3, 0x0f, 0x00, 0xf0], 10);
  bytes.set([0, 0, 1, 0xb9], 28);
  return bytes;
}

Deno.test("describePss: 幅x高さを返す", () => {
  assertEquals(describePss(syntheticPss()), "240x240");
});

Deno.test("describePss: 先頭がパックヘッダーでなければ失敗する", () => {
  const bytes = syntheticPss();
  bytes[3] = 0;
  assertThrows(() => describePss(bytes));
});

Deno.test("describePss: 終端コードが無ければ失敗する", () => {
  const bytes = syntheticPss();
  bytes[31] = 0;
  assertThrows(() => describePss(bytes));
});

Deno.test("describePss: sequence_headerが無ければ失敗する", () => {
  const bytes = syntheticPss();
  bytes[13] = 0;
  assertThrows(() => describePss(bytes));
});
