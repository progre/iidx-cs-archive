// 原盤の代わりに、メモリー上のバイト列を読み、読んだ位置を記録する。
import { assertEquals } from "@std/assert";
import { type ManifestSongDraft, type OpenDisc, SEC } from "@csa/core";
import { soundMeasuresOf } from "./sound_measures.ts";

/** ハッシュは先頭の値、長さは0でない値の数にする */
const ports: Parameters<typeof soundMeasuresOf>[0] = {
  contentLength: async (size, read) =>
    (await read(0, size)).filter((byte) => byte !== 0).length,
  soundPrint: (kind, bytes) =>
    Promise.resolve({ body: String(bytes[0]), header: null, kind }),
};

const asset = (sourceFileIndex: number) => ({
  kind: "bgm" as const,
  references: [],
  sourceArchive: "a.dat;1",
  sourceFileIndex,
  sourceOffset: sourceFileIndex,
  sourceSize: 2,
});

const draft: ManifestSongDraft = {
  assets: [asset(5), asset(6)],
  canonicalKey: "song",
  sourceAssets: [],
  sourceGeneration: "9th",
  sourceSongIndex: 1,
  title: "song",
};

Deno.test("求め済みの音は読まず、ほかの音は1回だけ読んでハッシュと長さを求める", async () => {
  const reads: number[] = [];
  const opened = {
    disc: {
      readAt: (offset: number) => {
        reads.push(offset);
        return Promise.resolve(Uint8Array.of(offset % SEC, 0));
      },
    },
    files: new Map([["A.DAT", { lba: 1, size: SEC }]]),
  } as unknown as OpenDisc;
  const measures = await soundMeasuresOf(ports, opened, "9th", [draft], {
    lengths: new Map([["9th:5", 9]]),
    prints: new Map([["9th:5", { body: "x", header: null, kind: "bgm" }]]),
  });
  assertEquals(reads, [SEC + 6]);
  assertEquals(measures.prints.get("9th:5")?.body, "x");
  assertEquals(measures.prints.get("9th:6")?.body, "6");
  assertEquals(Object.fromEntries(measures.lengths), {
    "9th:5": 9,
    "9th:6": 1,
  });
});
