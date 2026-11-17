import { assertEquals } from "@std/assert";
import type { IndividualAssetManifest, ManifestSong } from "@csa/core";
import { songCapacityDemand } from "./capacity.ts";

const song = (overlayPackages: number, isVariant: boolean): ManifestSong =>
  ({
    overlay: {
      packages: Array.from({ length: overlayPackages }, () => ({})),
      pairs: [],
    },
    variantOf: isVariant ? {} : undefined,
  }) as unknown as ManifestSong;

const manifest = (songs: ManifestSong[]): IndividualAssetManifest =>
  ({
    expectedNewAbcCount: 5,
    songs,
    targetSongCount: 120,
  }) as unknown as IndividualAssetManifest;

Deno.test("DATA1は曲ごとに曲名カード1本とオーバーレイの本数を足す", () => {
  const demand = songCapacityDemand(
    manifest([song(0, false), song(2, false), song(1, true)]),
  );
  assertEquals(demand.data1Needed, 1469 + 3 + 3);
});

Deno.test("ABC表は原盤の件数に追加件数を足す", () => {
  assertEquals(songCapacityDemand(manifest([])).abcNeeded, 1066 + 5);
});

Deno.test("曲数は目標の曲数で、裏エントリーは差し替え元を持つ曲だけ数える", () => {
  const demand = songCapacityDemand(
    manifest([song(0, true), song(0, false), song(0, true)]),
  );
  assertEquals(demand.songCount, 120);
  assertEquals(demand.variants, 2);
});

Deno.test("オーバーレイを持たない曲も曲名カードの1本を数える", () => {
  const withoutOverlay = { variantOf: undefined } as unknown as ManifestSong;
  assertEquals(
    songCapacityDemand(manifest([withoutOverlay])).data1Needed,
    1469 + 1,
  );
});
