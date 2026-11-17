import { assertEquals, assertThrows } from "@std/assert";
import type { IndividualAssetManifest } from "@csa/core";
import {
  appendedPlacements,
  freedRangesOf,
  type ImageFiles,
  REGION_WINDOW_BYTES,
  reusedPlacements,
  untouchedWindows,
  validateGenerationSlices,
} from "./image_checks.ts";
import type { PlacementPlan } from "../../types.ts";

const FILES: ImageFiles = new Map([["DATA.DAT", { lba: 100, size: 10_000 }]]);

Deno.test("原盤の空いた領域に置く資産と、終端に連ねる資産を分ける", () => {
  const plan = {
    assetRange: { startLba: 50, endLba: 60 },
    placements: [{ lba: 10 }, { lba: 50 }, { lba: 55 }],
  } as PlacementPlan;
  assertEquals(reusedPlacements(plan).map(({ lba }) => lba), [10]);
  assertEquals(appendedPlacements(plan).map(({ lba }) => lba), [50, 55]);
});

Deno.test("参照されなくなったファイルをセクター境界のLBA範囲にする", () => {
  const freed = [
    { abcIndex: 1, archive: "data.dat", offset: 4096, size: 5000 },
  ];
  assertEquals(freedRangesOf(FILES, freed), [{ startLba: 102, endLba: 104 }]);
  assertEquals(freedRangesOf(FILES, undefined), []);
});

Deno.test("境界に無いか範囲外か、ファイルが無い範囲は例外にする", () => {
  const entry = { abcIndex: 1, archive: "data.dat", offset: 0, size: 100 };
  assertThrows(() => freedRangesOf(FILES, [{ ...entry, offset: 1 }]), Error);
  assertThrows(() => freedRangesOf(FILES, [{ ...entry, size: 20_000 }]), Error);
  assertThrows(() => freedRangesOf(FILES, [{ ...entry, archive: "x" }]), Error);
});

const manifestOf = (sourceOffset: number, sourceSize: number) =>
  ({
    songs: [{
      sourceGeneration: "9th",
      sourceSongIndex: 3,
      assets: [{
        sourceArchive: "DATA.DAT;1",
        sourceFileIndex: 7,
        sourceOffset,
        sourceSize,
      }],
    }],
  }) as unknown as IndividualAssetManifest;

Deno.test("アーカイブに収まる資産は通り、範囲外は例外にする", () => {
  const imageBytes = 200 * 2048;
  validateGenerationSlices(manifestOf(0, 100), "9th", FILES, imageBytes);
  assertThrows(
    () => validateGenerationSlices(manifestOf(9_950, 100), "9th", FILES, 1e9),
    Error,
    "範囲外",
  );
  assertThrows(
    () => validateGenerationSlices(manifestOf(0, 100), "9th", FILES, 1000),
    Error,
    "image終端",
  );
});

Deno.test("書き換えた範囲に掛かる窓は、比べる窓から外す", () => {
  const region = 64 * REGION_WINDOW_BYTES;
  const all = untouchedWindows(region, []);
  assertEquals(all.length, 18);
  const rewritten: [number, number][] = [[0, 10]];
  const rest = untouchedWindows(region, rewritten);
  assertEquals(rest.length, all.length - 1);
  assertEquals(rest.includes(0), false);
});
