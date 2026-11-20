// 原盤の代わりに、メモリー上のバイト列を読み、読んだ範囲を記録する。
// 長さの数え方は、呼び先の feature が確かめる。

import { assertEquals } from "@std/assert";
import { type OpenDisc, SEC } from "@csa/core";
import { overlayMeasuresOf } from "./overlay_measures.ts";

/** `A.DAT`の2セクタ目から、7で埋まったオーバーレイが続く */
function disc(reads: number[][]): OpenDisc {
  const bytes = new Uint8Array(5 * SEC);
  bytes.fill(7, 3 * SEC, 5 * SEC);
  return {
    disc: {
      readAt: (offset: number, size: number) => {
        reads.push([offset, size]);
        return Promise.resolve(bytes.slice(offset, offset + size));
      },
    },
    files: new Map([["A.DAT", { lba: 1, size: 4 * SEC }]]),
  } as unknown as OpenDisc;
}

/** 9th以降は先頭の値を長さにする。ハッシュは読んだ長さにする */
const ports: Parameters<typeof overlayMeasuresOf>[0] = {
  ifPayloadLength: async (read) => (await read(0, 1))[0],
  isLegacyOverlay: (generation) => generation === "8th",
  printOf: (bytes) => Promise.resolve(String(bytes.length)),
};

const slice = (sourceFileIndex: number, offset: number, size: number) => ({
  sourceArchive: "a.dat;1",
  sourceFileIndex,
  sourceOffset: offset,
  sourceSize: size,
});

Deno.test("9th以降は、記述子を読んだ続きから中身を読み、手前に戻らない", async () => {
  const reads: number[][] = [];
  const measures = await overlayMeasuresOf(ports, disc(reads), "9th", [
    slice(5, 2 * SEC, 2 * SEC),
  ]);
  assertEquals(Object.fromEntries(measures.lengths), { "if:9th:5": 7 });
  assertEquals(Object.fromEntries(measures.prints), { "if:9th:5": "7" });
  assertEquals(reads, [[3 * SEC, 1], [3 * SEC + 1, 6]]);
});

Deno.test("3rd〜8thは、ファイル表の大きさを長さにする", async () => {
  const measures = await overlayMeasuresOf(ports, disc([]), "8th", [
    slice(5, 2 * SEC, 1234),
  ]);
  assertEquals(Object.fromEntries(measures.lengths), { "if:8th:5": 1234 });
  assertEquals(Object.fromEntries(measures.prints), { "if:8th:5": "1234" });
});
