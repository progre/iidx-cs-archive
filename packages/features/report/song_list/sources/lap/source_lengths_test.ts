// 原盤の代わりに、メモリー上のバイト列を読む。長さの数え方は、呼び先の feature が確かめる。

import { assertEquals } from "@std/assert";
import { type ManifestSongDraft, type OpenDisc, SEC } from "@csa/core";
import { sourceLengthsOf } from "./source_lengths.ts";

/** `A.DAT`の先頭(音)は、1が100バイト続き、残りは0である。2セクタ目(オーバーレイ)は7で埋まる */
function disc(): OpenDisc {
  const bytes = new Uint8Array(5 * SEC);
  bytes.fill(1, SEC, SEC + 100);
  bytes.fill(7, 3 * SEC, 5 * SEC);
  return {
    disc: {
      readAt: (offset: number, size: number) =>
        Promise.resolve(bytes.slice(offset, offset + size)),
    },
    files: new Map([["A.DAT", { lba: 1, size: 4 * SEC }]]),
  } as unknown as OpenDisc;
}

/** 音は0でない値の数を長さにする。9th以降のオーバーレイは先頭の値を長さにする */
const ports: Parameters<typeof sourceLengthsOf>[0] = {
  contentLength: async (size, read) =>
    (await read(0, size)).filter((byte) => byte !== 0).length,
  ifPayloadLength: async (read) => (await read(0, 1))[0],
  isLegacyOverlay: (generation) => generation === "8th",
};

const slice = (sourceFileIndex: number, offset: number, size: number) => ({
  sourceArchive: "a.dat;1",
  sourceFileIndex,
  sourceOffset: offset,
  sourceSize: size,
});

const draft: ManifestSongDraft = {
  assets: [{ ...slice(5, 0, 2 * SEC), kind: "bgm", references: [] }],
  canonicalKey: "song",
  sourceAssets: [],
  sourceGeneration: "9th",
  sourceSongIndex: 1,
  title: "song",
};

Deno.test("音と9th以降のオーバーレイを、原盤の位置から読んで、別の識別子で数える", async () => {
  const lengths = await sourceLengthsOf(ports, disc(), "9th", [draft], [
    slice(5, 2 * SEC, 2 * SEC),
  ]);
  assertEquals(Object.fromEntries(lengths), { "9th:5": 100, "if:9th:5": 7 });
});

Deno.test("3rd〜8thのオーバーレイは、ファイル表の大きさを長さにする", async () => {
  const lengths = await sourceLengthsOf(ports, disc(), "8th", [], [
    slice(5, 2 * SEC, 1234),
  ]);
  assertEquals(Object.fromEntries(lengths), { "if:8th:5": 1234 });
});
