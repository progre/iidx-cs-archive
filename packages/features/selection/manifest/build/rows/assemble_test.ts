// manifest全体の組み立て。
// 実行: deno test packages/features/selection/manifest/build/rows/assemble_test.ts

import { assertEquals } from "@std/assert";
import type { ManifestAsset, ManifestSong } from "@csa/core";
import { assembleManifest, type ManifestParts } from "./assemble.ts";

const asset = {
  kind: "chart",
  references: [],
  sourceArchive: "a",
  sourceFileIndex: 1,
  sourceOffset: 0,
  sourceSize: 1,
} as ManifestAsset;

const song = (videoFields: number[]): ManifestSong => ({
  assets: [asset, asset],
  canonicalKey: "song",
  entry: "",
  sourceGeneration: "9th",
  sourceSongIndex: 1,
  targetSongIndex: 99,
  title: "song",
  videoFields,
});

const parts = (songs: ManifestSong[]): ManifestParts => ({
  freedPbFiles: [],
  pbVideoRedirects: [],
  sharedVideoAbcIndex: 900,
  songs,
  sources: {},
  targetSongCount: 101,
});

Deno.test("資産の件数を数え、キーを決まった順に並べる", () => {
  const manifest = assembleManifest(parts([song([]), song([])]));
  assertEquals(manifest.expectedNewAbcCount, 4);
  assertEquals(Object.keys(manifest), [
    "expectedNewAbcCount",
    "freedPbFiles",
    "pbVideoRedirects",
    "sources",
    "targetSongCount",
    "songs",
  ]);
});

Deno.test("共有BGAを参照させる曲があるときだけ、共有BGAのABC indexを書く", () => {
  assertEquals(
    assembleManifest(parts([song([0x58])])).sharedVideoAbcIndex,
    900,
  );
  assertEquals(
    "sharedVideoAbcIndex" in assembleManifest(parts([song([])])),
    false,
  );
});
