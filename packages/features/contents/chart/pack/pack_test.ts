import { assertEquals, assertThrows } from "@std/assert";
import { decryptCbcCts, encryptCbcCts } from "./blowfish_cts.ts";
import { packLzChart, planPackedChartIndex } from "./bundle.ts";
import { decodeLz, encodeLz } from "./lz.ts";
import { encryptLzChart } from "./bundle.ts";

const TEST_KEY = new TextEncoder().encode("0123456789abcdef");

const sequence = (length: number, step = 7) =>
  Uint8Array.from({ length }, (_, i) => (i * step + 3) & 0xff);

const lzChartOf = (sourceFileIndex: number, plain: Uint8Array) => ({
  lz: encodeLz(plain),
  plainSize: plain.length,
  sourceFileIndex,
});

Deno.test("encodeLzは出力長が8の倍数にならず、decodeLzで元に戻る", () => {
  for (const length of [0, 1, 6, 7, 8, 9, 15, 16, 100, 1000]) {
    const data = sequence(length);
    const encoded = encodeLz(data);
    assertEquals(encoded.length % 8 !== 0, true, `length=${length}`);
    assertEquals(decodeLz(encoded), data, `length=${length}`);
  }
});

Deno.test("encodeLzは8トークンごとの制御バイトと終端トークンを置く", () => {
  assertEquals(
    [...encodeLz(Uint8Array.of(1, 2))],
    [0b100, 1, 2, 0xff],
  );
});

Deno.test("decodeLzは距離と長さの参照とリテラル列を読む", () => {
  const input = Uint8Array.of(
    0b11100,
    10,
    20,
    // 参照: 距離は(0x90 & 0x0f) + 1 = 1、長さは(0x90 >> 4) - 7 = 2なので3バイト写す
    0x90,
    // リテラル列: 0xc0 - 0xb9 + 1 = 8バイト
    0xc0,
    1,
    2,
    3,
    4,
    5,
    6,
    7,
    8,
    0xff,
  );
  assertEquals([...decodeLz(input)], [
    10,
    20,
    20,
    20,
    20,
    1,
    2,
    3,
    4,
    5,
    6,
    7,
    8,
  ]);
});

Deno.test("CBC-CTSは暗号化して復号すると元に戻る", () => {
  for (const length of [9, 10, 15, 17, 23, 100, 1001]) {
    if (length % 8 === 0) {
      continue;
    }
    const data = sequence(length, 13);
    const encrypted = encryptCbcCts(data, TEST_KEY);
    assertEquals(encrypted.length, length);
    assertEquals(decryptCbcCts(encrypted, TEST_KEY), data, `${length}`);
  }
});

Deno.test("CBC-CTSは末尾が0のデータも復号で落とさない", () => {
  const data = new Uint8Array(21);
  assertEquals(
    decryptCbcCts(encryptCbcCts(data, TEST_KEY), TEST_KEY),
    data,
  );
});

Deno.test("CBC-CTSは8の倍数の長さと8バイト以下を拒む", () => {
  assertThrows(() => encryptCbcCts(new Uint8Array(16), TEST_KEY));
  assertThrows(() => encryptCbcCts(new Uint8Array(8), TEST_KEY));
  assertThrows(() => decryptCbcCts(new Uint8Array(5), TEST_KEY));
});

Deno.test("packLzChartは、LZ済みの譜面を暗号化し、復号するとLZに戻る", () => {
  const chart = lzChartOf(4, sequence(120, 5));
  const packed = packLzChart(chart, TEST_KEY);
  assertEquals(packed, encryptLzChart(chart.lz, TEST_KEY));
  assertEquals(decryptCbcCts(packed, TEST_KEY), chart.lz);
});

Deno.test("packLzChartは、展開後の長さが合わない譜面を拒む", () => {
  assertThrows(() =>
    packLzChart(
      { lz: encodeLz(sequence(40)), plainSize: 41, sourceFileIndex: 1 },
      TEST_KEY,
    )
  );
});

Deno.test("planPackedChartIndexは、渡した順に位置を割り当て、長さを合計する", () => {
  const planned = planPackedChartIndex([
    { plainSize: 150, size: 40, sourceFileIndex: 2 },
    { plainSize: 77, size: 30, sourceFileIndex: 5 },
  ]);
  assertEquals(planned, {
    bundleBytes: 70,
    charts: [
      { offset: 0, plainSize: 150, size: 40, sourceFileIndex: 2 },
      { offset: 40, plainSize: 77, size: 30, sourceFileIndex: 5 },
    ],
    plainBytes: 227,
  });
});
