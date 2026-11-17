import { assertEquals, assertThrows } from "@std/assert";
import type { IndividualAssetManifest, ManifestSong } from "@csa/core";
import type { PlacementPlan } from "../types.ts";
import { plannedOverlayIndices, songOverlayOf } from "./overlay.ts";
import { elfContentOf, elfPlacementOf } from "./placement.ts";
import { assertPlanMatchesManifest, elfSongPartsOf } from "./songs.ts";

const overlayPackage = {
  sourceArchive: "a.dat",
  sourceFileIndex: 4,
  sourceOffset: 0,
  sourceSize: 2048,
  sourceGeneration: "gen",
  newData1Index: 1500,
};

const plan = {
  assets: [
    {
      newAbcIndex: 1066,
      references: [{ fieldOffset: 8, width: "u16" }],
      targetSongIndex: 200,
    },
  ],
  data1: {
    baseLba: 50,
    imageSets: [],
    overlayPackages: [overlayPackage],
    titleCards: [],
  },
  placements: [{ lba: 100, newAbcIndex: 1066, sectors: 2, sourceSize: 3000 }],
} as unknown as PlacementPlan;

const song = (overrides: Record<string, unknown>) =>
  ({
    entry: btoa("\x01\x02"),
    sourceGeneration: "gen",
    targetSongIndex: 200,
    videoFields: [1],
    ...overrides,
  }) as unknown as ManifestSong;

const manifestOf = (songs: ManifestSong[]) =>
  ({
    expectedNewAbcCount: 1,
    sources: { gen: { entryRanges: [[0, 2]] } },
    songs,
  }) as unknown as IndividualAssetManifest;

Deno.test("曲のABC参照は、同じ曲の配置済み資産から作る", () => {
  const [part] = elfSongPartsOf(manifestOf([song({})]), plan, new Map());
  assertEquals(part.abcReferences, [
    { fieldOffset: 8, newAbcIndex: 1066, width: "u16" },
  ]);
  assertEquals([...part.entry], [1, 2]);
  assertEquals(part.entryRanges, [[0, 2]]);
  assertEquals(part.videoFields, [1]);
});

Deno.test("資産が配置されていない曲のABC参照は空になる", () => {
  const [part] = elfSongPartsOf(
    manifestOf([song({ targetSongIndex: 201 })]),
    plan,
    new Map(),
  );
  assertEquals(part.abcReferences, []);
});

Deno.test("画像セット参照は曲の枠番号で引く", () => {
  const sprites = [{ fileIndex: 1, sprite: 2 }];
  const [part] = elfSongPartsOf(
    manifestOf([song({})]),
    plan,
    new Map([[200, sprites]]),
  );
  assertEquals(part.titleSprites, sprites);
});

Deno.test("素材が渡されていない世代の曲は例外を投げる", () => {
  assertThrows(
    () =>
      elfSongPartsOf(
        manifestOf([song({ sourceGeneration: "x" })]),
        plan,
        new Map(),
      ),
    Error,
    "xの素材が渡されていない",
  );
});

Deno.test("曲のオーバーレイのDATA1 indexは配置計画から引く", () => {
  const held = song({
    overlay: { packages: [overlayPackage], pairs: [] },
  });
  const [part] = elfSongPartsOf(manifestOf([held]), plan, new Map());
  assertEquals(part.overlayIndexOf(overlayPackage), 1500);
});

Deno.test("配置計画に無いオーバーレイは例外を投げる", () => {
  const held = song({
    overlay: {
      packages: [{ ...overlayPackage, sourceFileIndex: 9 }],
      pairs: [],
    },
  });
  const [part] = elfSongPartsOf(manifestOf([held]), plan, new Map());
  assertThrows(
    () => part.overlayIndexOf({ ...overlayPackage, sourceFileIndex: 9 }),
    Error,
    "song200のオーバーレイが配置に無い",
  );
});

Deno.test("オーバーレイを持たない曲は空のオーバーレイになる", () => {
  assertEquals(songOverlayOf(song({})), { packages: [], pairs: [] });
});

Deno.test("オーバーレイのDATA1 indexは世代と素材の位置を鍵にする", () => {
  assertEquals([...plannedOverlayIndices(plan).values()], [1500]);
});

Deno.test("配置計画とmanifestのABC件数が違えば例外を投げる", () => {
  assertPlanMatchesManifest(manifestOf([]), plan);
  assertThrows(
    () =>
      assertPlanMatchesManifest(
        { ...manifestOf([]), expectedNewAbcCount: 2 },
        plan,
      ),
    Error,
    "ABC件数が一致しない",
  );
});

Deno.test("配置は計画のLBAと採番をELFの入力の形に並べる", () => {
  const placement = elfPlacementOf(plan);
  assertEquals(placement.abcEntries, [
    { lba: 100, newAbcIndex: 1066, sectors: 2, sourceSize: 3000 },
  ]);
  assertEquals(placement.data1BaseLba, 50);
  assertEquals(placement.overlayPackages.length, 1);
});

Deno.test("組を持たない曲もPBムービーの付け替えも無ければ、キーを作らない", () => {
  const content = elfContentOf(manifestOf([]), [1], []);
  assertEquals(Object.keys(content).sort(), ["sharedVideoAbcIndex", "songs"]);
});

Deno.test("組を持たない曲とPBムービーの付け替えがあればキーを足す", () => {
  const redirects = [{ abcIndex: 1, flags: 0, songIndex: 2 }];
  const content = elfContentOf(
    { ...manifestOf([]), pbVideoRedirects: redirects },
    [1],
    ["pairless"],
  );
  assertEquals(content.pairlessSongs, ["pairless"]);
  assertEquals(content.pbVideos, redirects);
});
