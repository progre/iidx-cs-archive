// 譜面の値から平文譜面の番号を引く規則。実データを使わず、組み立てた値で確かめる。
// 実行: deno test packages/utils/chart_notes/locate_test.ts

import { type ChartSource, plainIndicesOf } from "./main.ts";

function assertJson(actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`${a} != ${e}`);
  }
}

const PLAIN: ChartSource = {
  areElfPointers: false,
  firstSerial: 0,
  flaggedShift: 138,
};

Deno.test("ELFの中の譜面は曲順・スロット順の連番になる", () => {
  const source = { ...PLAIN, areElfPointers: true, firstSerial: 348 };
  assertJson(
    plainIndicesOf([[100, 0, 200], [100, 0xffffffff], [300]], source),
    [[348, null, 349], [350, null], [351]],
  );
});

Deno.test("上位4ビットが0xFの値は、2番目のアーカイブの件数を足す", () => {
  assertJson(plainIndicesOf([[0xf0000007, 0xf0000000]], PLAIN), [[145, 138]]);
});

Deno.test("印の無い値はそのまま番号になる", () => {
  assertJson(plainIndicesOf([[289, 5]], PLAIN), [[289, 5]]);
});

Deno.test("0と0xffffffffは譜面が無い", () => {
  assertJson(plainIndicesOf([[0, 0xffffffff]], PLAIN), [[null, null]]);
});
