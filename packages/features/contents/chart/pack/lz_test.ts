import { assertEquals } from "@std/assert";
import { decodeLz, encodeLz } from "./lz.ts";

/** 繰り返しの少ない、決まった並びのバイト列 */
function scattered(length: number, seed = 1): Uint8Array {
  let state = seed;
  return Uint8Array.from({ length }, () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return (state >> 16) & 0xff;
  });
}

const join = (...parts: Uint8Array[]): Uint8Array =>
  Uint8Array.from(parts.flatMap((part) => [...part]));

function assertRoundTrip(data: Uint8Array, label: string): Uint8Array {
  const encoded = encodeLz(data);
  assertEquals(decodeLz(encoded), data, label);
  assertEquals(encoded.length % 8 !== 0, true, `${label}: 長さが8の倍数`);
  return encoded;
}

Deno.test("空の入力は終端トークンだけになる", () => {
  assertEquals([...assertRoundTrip(new Uint8Array(0), "空")], [0b1, 0xff]);
});

Deno.test("繰り返しの無い入力は、展開すると元に戻る", () => {
  for (const length of [1, 2, 3, 7, 8, 9, 100, 1000]) {
    assertRoundTrip(scattered(length), `length=${length}`);
  }
});

Deno.test("短い距離の3バイトの繰り返しは、1バイトの参照になる", () => {
  const encoded = assertRoundTrip(Uint8Array.of(1, 2, 3, 1, 2, 3), "短い参照");
  assertEquals([...encoded], [0b11000, 1, 2, 3, 0x92, 0xff]);
});

Deno.test("2バイトの繰り返しは、短い距離のときだけ参照になる", () => {
  const near = assertRoundTrip(Uint8Array.of(1, 2, 1, 2), "距離2");
  assertEquals([...near], [0b1100, 1, 2, 0x81, 0xff]);
  const far = join(
    Uint8Array.of(9, 8),
    Uint8Array.from({ length: 20 }, (_, i) => i + 100),
    Uint8Array.of(9, 8),
  );
  assertEquals(assertRoundTrip(far, "距離22").length > far.length, true);
});

Deno.test("長い距離の繰り返しは、2バイトの参照になる", () => {
  const block = Uint8Array.from({ length: 20 }, (_, i) => i * 7 + 3);
  const encoded = assertRoundTrip(
    join(block, block.subarray(0, 10)),
    "長い参照",
  );
  const at = encoded.findIndex((byte, i) =>
    byte === 28 && encoded[i + 1] === 20
  );
  assertEquals(at >= 0, true);
});

Deno.test("参照の長さと距離の境界で、展開すると元に戻る", () => {
  const counts = [2, 3, 4, 5, 6, 33, 34, 35, 36, 100];
  const distances = [1, 2, 15, 16, 17, 100, 1022, 1023, 1024, 1025, 3000];
  for (const distance of distances) {
    for (const count of counts) {
      const block = scattered(distance, distance + count);
      const data = join(block, scattered(7, 99), block.subarray(0, count));
      assertRoundTrip(data, `distance=${distance} count=${count}`);
    }
  }
});

Deno.test("同じ1バイトが続く入力は、重なる参照で小さくなる", () => {
  const data = new Uint8Array(1000);
  const encoded = assertRoundTrip(data, "ゼロ");
  assertEquals(encoded.length < 100, true);
});

Deno.test("繰り返しの多い入力は、元より小さくなる", () => {
  const unit = scattered(60, 5);
  const data = join(...Array.from({ length: 50 }, () => unit));
  const encoded = assertRoundTrip(data, "繰り返し");
  assertEquals(encoded.length < data.length / 4, true);
});

Deno.test("大きな入力も展開すると元に戻る", () => {
  const data = join(scattered(100_000, 3), scattered(100_000, 3));
  assertRoundTrip(data, "大きな入力");
});
