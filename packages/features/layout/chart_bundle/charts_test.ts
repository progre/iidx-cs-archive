// 譜面source file indexの抽出(`regeneration.ts`)と、bundleのindexからの配置を検査する。
import { chartSourceFileIndices, type PackedChartIndex } from "./place.ts";
import { placePackedCharts } from "./place.ts";
import type {
  IndividualAssetManifest,
  ManifestAsset,
  ManifestSong,
} from "@csa/core";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const chartAsset = (sourceFileIndex: number): ManifestAsset => ({
  kind: "chart",
  references: [],
  sourceArchive: "unused",
  sourceFileIndex,
  sourceOffset: 0,
  sourceSize: 0,
});

const song = (generation: string, assets: ManifestAsset[]): ManifestSong => ({
  assets,
  canonicalKey: "song",
  entry: "",
  sourceGeneration: generation,
  sourceSongIndex: 0,
  targetSongIndex: 99,
  title: "song",
  videoFields: [],
});

const fixture = (songs: ManifestSong[] = []): IndividualAssetManifest => ({
  expectedNewAbcCount: 0,
  sources: {
    "djt": {
      elf: "unused",
      entryRanges: [[0, 1]],
      songmap: "unused",
    },
  },
  targetSongCount: 99,
  songs,
});

Deno.test("譜面source file indexは対象世代のchart資産だけを拾う", () => {
  const source = fixture([
    song("djt", [chartAsset(5), { ...chartAsset(6), kind: "video" }]),
    song("emp", [chartAsset(9)]),
  ]);
  const indices = chartSourceFileIndices(source, "djt");
  assert(indices.size === 1 && indices.has(5), "世代・種別で絞れていない");
});

Deno.test("indexに従って譜面を配置できる", () => {
  const generation = "djt";
  const packed: PackedChartIndex = {
    bundleBytes: 5,
    charts: [
      { offset: 0, plainSize: 2, size: 3, sourceFileIndex: 5 },
      { offset: 3, plainSize: 4, size: 2, sourceFileIndex: 7 },
    ],
    plainBytes: 6,
  };
  const manifest = fixture([song(generation, [chartAsset(5), chartAsset(7)])]);
  const summary = placePackedCharts(manifest, generation, packed);
  const assets = manifest.songs[0].assets;
  assert(
    assets[0].sourceOffset === 0 && assets[0].sourceSize === 3,
    "1件目の配置が違う",
  );
  assert(
    assets[1].sourceOffset === 3 && assets[1].sourceSize === 2,
    "2件目の配置が違う",
  );
  assert(summary.includes("djt 2 charts"), "要約に件数が出ていない");
});
