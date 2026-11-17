// manifestの内訳の文章。
// 実行: deno test packages/features/selection/manifest/build/report_test.ts

import { assertEquals } from "@std/assert";
import type {
  IndividualAssetManifest,
  ManifestSong,
  ManifestSongDraft,
} from "@csa/core";
import { manifestReportLines } from "./report.ts";

const row = (generation: string, songId: number): ManifestSongDraft => ({
  sourceAssets: [],
  canonicalKey: "song",
  sourceGeneration: generation,
  sourceSongIndex: songId,
  title: "song",
});

const manifestSong = (
  generation: string,
  videoFields: number[],
  withCard: boolean,
): ManifestSong => ({
  assets: [],
  canonicalKey: "song",
  entry: "",
  sourceGeneration: generation,
  sourceSongIndex: 1,
  targetSongIndex: 99,
  title: "song",
  ...(withCard
    ? {
      titleCard: {
        pairs: [],
        sourceArchive: "a",
        sourceFileIndex: 1,
        sourceOffset: 0,
        sourceSize: 1,
      },
    }
    : {}),
  videoFields,
});

Deno.test("内訳を3行の文章にする", () => {
  const manifest = {
    expectedNewAbcCount: 7,
    sources: { "9th": {}, "emp": {} },
    targetSongCount: 101,
    songs: [
      manifestSong("9th", [0x58], false),
      manifestSong("emp", [], true),
    ],
  } as unknown as IndividualAssetManifest;
  const selected = [row("9th", 1), row("emp", 2)];
  assertEquals(manifestReportLines(manifest, selected, []), [
    "101-song manifest: 2 songs (9th=1 emp=1) / back entries 0 / ABC 7 / " +
    "original videos 1 songs, fallback BGA 1 songs",
    "5-key versions: 0 songs / dropped with an unselected front 0 songs",
    "missing title cards: 9th=1",
  ]);
});
