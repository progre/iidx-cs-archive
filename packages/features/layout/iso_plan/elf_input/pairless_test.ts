import { assertEquals, assertThrows } from "@std/assert";
import type { IndividualAssetManifest } from "@csa/core";
import { pairlessCandidatesOf, pairlessPackageLookup } from "./pairless.ts";
import type { PlacementPlan } from "../types.ts";

const manifest = {
  songs: [
    { sourceGeneration: "gen", sourceSongIndex: 9, targetSongIndex: 200 },
    { sourceGeneration: "gen", sourceSongIndex: 10, targetSongIndex: 201 },
    { sourceGeneration: "other", sourceSongIndex: 9, targetSongIndex: 202 },
  ],
} as unknown as IndividualAssetManifest;

const planOf = (
  packages: {
    sourceGeneration: string;
    sourceFileIndex: number;
    index: number;
  }[],
) =>
  ({
    data1: {
      overlayPackages: packages.map((item) => ({
        newData1Index: item.index,
        sourceFileIndex: item.sourceFileIndex,
        sourceGeneration: item.sourceGeneration,
      })),
    },
  }) as unknown as PlacementPlan;

const candidate = {
  descriptorOffset: 0x100,
  sourceGeneration: "gen",
  targetSongIndex: 200,
};

Deno.test("一覧に載る素材の曲だけが候補になる", () => {
  const found = pairlessCandidatesOf(
    manifest,
    (generation) =>
      generation === "gen" ? [{ descriptorOffset: 0x100, songIndex: 9 }] : [],
  );
  assertEquals(found, [candidate]);
});

Deno.test("一覧が空なら候補は無い", () => {
  assertEquals(pairlessCandidatesOf(manifest, () => []), []);
});

Deno.test("素材の世代とファイル番号が揃うパッケージのDATA1 indexを返す", () => {
  const lookup = pairlessPackageLookup(
    candidate,
    planOf([
      { index: 1500, sourceFileIndex: 3, sourceGeneration: "other" },
      { index: 1501, sourceFileIndex: 3, sourceGeneration: "gen" },
    ]),
  );
  assertEquals(lookup(3), 1501);
});

Deno.test("配置に無いパッケージはundefinedを返す", () => {
  const lookup = pairlessPackageLookup(candidate, planOf([]));
  assertEquals(lookup(3), undefined);
});

Deno.test("分けた本が2本以上なら例外を投げる", () => {
  const lookup = pairlessPackageLookup(
    candidate,
    planOf([
      { index: 1500, sourceFileIndex: 3, sourceGeneration: "gen" },
      { index: 1501, sourceFileIndex: 3, sourceGeneration: "gen" },
    ]),
  );
  assertThrows(() => lookup(3), Error, "分けられている");
});
