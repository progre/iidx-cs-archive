// 実行: deno test packages/features/layout/display_prepare/split/overlay_split_test.ts
// 分けた本をmanifestへ差し込む振り直しを確かめる。

import {
  generatedSourceArchive,
  type IndividualAssetManifest,
  type ManifestSong,
} from "@csa/core";
import {
  fileSourcesOf,
  type OverlayPart,
  overLimitPackages,
  rewriteOverlayPackages,
} from "./overlay_split.ts";

const PACKAGE_COUNT = 8;

function assertEquals<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: ${String(actual)} != ${String(expected)}`);
  }
}

const slice = (fileIndex: number, archive = "data1.dat") => ({
  sourceArchive: archive,
  sourceFileIndex: fileIndex,
  sourceOffset: 0,
  sourceSize: 2048,
});

/** 1曲が2本を指し、1本目だけが場面5と場面7の2本に分かれる */
function overlaySong(packages: number[]): ManifestSong {
  return {
    assets: [],
    canonicalKey: "song",
    entry: "",
    overlay: {
      packages: packages.map((fileIndex) => slice(fileIndex)),
      pairs: [
        { animation: 5, packageIndex: 0 },
        { animation: 9, packageIndex: packages.length - 1 },
        { animation: 7, packageIndex: 0 },
      ],
    },
    sourceGeneration: "dd",
    sourceSongIndex: 0,
    targetSongIndex: 1,
    title: "song",
    videoFields: [],
  };
}

const manifestOf = (song: ManifestSong): IndividualAssetManifest => ({
  expectedNewAbcCount: 0,
  sources: {},
  songs: [song],
  targetSongCount: 1,
});

const splitParts = (): Map<string, OverlayPart[]> =>
  new Map([["dd/data1.dat/415", [
    { animations: [5], package: slice(415, "__file__/a.if") },
    { animations: [7], package: slice(415, "__file__/b.if") },
  ]]]);

Deno.test("分けた本は元の位置へ差し込まれ、組は新しい添字を指す", () => {
  const manifest = rewriteOverlayPackages(
    manifestOf(overlaySong([415, 416])),
    splitParts(),
    PACKAGE_COUNT,
  );
  const overlay = manifest.songs[0].overlay!;
  assertEquals(
    overlay.packages.map((item) => item.sourceArchive).join(" "),
    "__file__/a.if __file__/b.if data1.dat",
    "分けた本の後ろへ元の並びが続く",
  );
  assertEquals(
    overlay.pairs.map((pair) => `${pair?.animation}:${pair?.packageIndex}`)
      .join(" "),
    "5:0 9:2 7:1",
    "枠の位置は変えずに添字を振り直す",
  );
});

Deno.test("分けた本が一覧の8枠に収まらないと停止する", () => {
  const song = overlaySong([415, 416, 417, 418, 419, 420, 421, 422]);
  try {
    rewriteOverlayPackages(manifestOf(song), splitParts(), PACKAGE_COUNT);
  } catch (error) {
    assertEquals(String(error).includes("パッケージが9本"), true, "停止の理由");
    return;
  }
  throw new Error("枠の超過で停止しなかった");
});

Deno.test("上限を超える本だけを、場面と残り枠とともに集める", () => {
  const song = overlaySong([415, 416]);
  const big = { ...slice(415), sourceSize: 2048 * 5 };
  song.overlay!.packages[0] = big;
  const found = overLimitPackages(manifestOf(song), {
    packageCount: PACKAGE_COUNT,
    sectorLimit: 4,
  });
  assertEquals(found.size, 1, "超過した本の数");
  const only = [...found.values()][0];
  assertEquals([...only.scenes].sort().join(","), "5,7", "場面");
  assertEquals(only.budget, PACKAGE_COUNT - 2 + 1, "他の本のぶんを引く");
});

Deno.test("単体ファイルのpathを、原盤のアーカイブを除いて集める", () => {
  const manifest = {
    songs: [{
      assets: [{
        sourceArchive: generatedSourceArchive("file", "x/asset.bin"),
      }],
      overlay: {
        packages: [{
          sourceArchive: generatedSourceArchive("file", "x/overlay.if"),
        }],
      },
      titleCard: { sourceArchive: "DATA1.DAT" },
    }],
  } as unknown as IndividualAssetManifest;
  assertEquals(
    JSON.stringify(Object.fromEntries(fileSourcesOf(manifest))),
    JSON.stringify({
      "__file__/x/asset.bin": "x/asset.bin",
      "__file__/x/overlay.if": "x/overlay.if",
    }),
    "集めた単体ファイル",
  );
});
