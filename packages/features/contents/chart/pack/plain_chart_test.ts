import { assertEquals } from "@std/assert";
import { decryptCbcWholeBlocks, encryptCbcCts } from "./blowfish_cts.ts";
import { encodeLz } from "./lz.ts";
import { plainChartOf } from "../lz_store/mod.ts";

const KEY = new TextEncoder().encode("0123456789abcdef");

const sequence = (length: number) =>
  Uint8Array.from({ length }, (_, i) => (i * 11 + 5) & 0xff);

Deno.test("plainChartOfは鍵が無ければLZだけを展開する", () => {
  const plain = sequence(50);
  assertEquals(plainChartOf(encodeLz(plain), null), plain);
});

Deno.test("plainChartOfは復号してからLZを展開する", () => {
  const plain = sequence(300);
  const encrypted = encryptCbcCts(encodeLz(plain), KEY);
  assertEquals(plainChartOf(encrypted, KEY), plain);
});

Deno.test("8の倍数の長さは、ブロックごとに復号する", () => {
  const data = sequence(33);
  const encrypted = encryptCbcCts(data, KEY);
  // CBC-CTSの暗号文は、末尾の2ブロックを除いて通常のCBCと同じ
  const whole = encrypted.subarray(0, 24);
  assertEquals(decryptCbcWholeBlocks(whole, KEY), data.subarray(0, 24));
});
