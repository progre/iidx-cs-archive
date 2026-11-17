// 原盤の代わりに、メモリー上のバイト列を読み、読んだ回数を数える。
import { assertEquals } from "@std/assert";
import {
  type ManifestSongDraft,
  type OpenDisc,
  SEC,
  type SoundPrint,
} from "@csa/core";
import { soundPrintsOf } from "./prints.ts";

const ports: Parameters<typeof soundPrintsOf>[0] = {
  soundPrint: (kind, bytes) =>
    Promise.resolve({ body: String(bytes[0]), header: null, kind }),
} as Parameters<typeof soundPrintsOf>[0];

const asset = (sourceFileIndex: number) => ({
  kind: "bgm" as const,
  references: [],
  sourceArchive: "a.dat;1",
  sourceFileIndex,
  sourceOffset: sourceFileIndex,
  sourceSize: 1,
});

const draft: ManifestSongDraft = {
  assets: [asset(5), asset(6)],
  canonicalKey: "song",
  sourceAssets: [],
  sourceGeneration: "9th",
  sourceSongIndex: 1,
  title: "song",
};

Deno.test("ハッシュを求め済みの音は、原盤から読まない", async () => {
  const reads: number[] = [];
  const opened = {
    disc: {
      readAt: (offset: number) => {
        reads.push(offset);
        return Promise.resolve(Uint8Array.of(offset % SEC));
      },
    },
    files: new Map([["A.DAT", { lba: 1, size: SEC }]]),
  } as unknown as OpenDisc;
  const known = new Map<string, SoundPrint>([
    ["9th:5", { body: "x", header: null, kind: "bgm" }],
  ]);
  const prints = await soundPrintsOf(ports, opened, "9th", [draft], known);
  assertEquals(reads, [SEC + 6]);
  assertEquals(prints.get("9th:5")?.body, "x");
  assertEquals(prints.get("9th:6")?.body, "6");
});
