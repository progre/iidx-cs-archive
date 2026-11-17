import { assertEquals, assertThrows } from "@std/assert";
import { PB_ENTRY } from "./song_db.ts";
import { difficultyOf } from "@csa/contents-song-db";
import type { IndividualAssetManifest, ManifestSong } from "@csa/core";
import type { PlacementPlan } from "@csa/layout-iso-plan";
import { ubElfInput, ubSongCapacity } from "./elf_input.ts";

const song = {
  assets: [],
  entry: btoa("\x01\x02"),
  overlay: {
    packages: [{
      sourceArchive: "a.dat",
      sourceFileIndex: 4,
      sourceOffset: 0,
      sourceSize: 2048,
    }],
    pairs: [{ animation: 3, packageIndex: 0 }],
  },
  sourceGeneration: "gen",
  sourceSongIndex: 1,
  targetSongIndex: 200,
  videoFields: [],
} as unknown as ManifestSong;

const manifest = {
  expectedNewAbcCount: 0,
  songs: [song],
  sources: { gen: { entryRanges: [[0, 2]] } },
  targetSongCount: 120,
} as unknown as IndividualAssetManifest;

const plan = {
  assets: [],
  data1: {
    baseLba: 50,
    imageSets: [],
    overlayPackages: [{
      lba: 60,
      newData1Index: 1500,
      relativeSector: 10,
      sectors: 2,
      sourceArchive: "a.dat",
      sourceFileIndex: 4,
      sourceGeneration: "gen",
    }],
    titleCards: [],
  },
  placements: [],
} as unknown as PlacementPlan;

const input = () =>
  ubElfInput({
    capacity: ubSongCapacity(manifest),
    manifest,
    plan,
    songSprites: new Map(),
    sourceElfOf: () => {
      throw new Error("実行ファイルは読まない");
    },
  });

Deno.test("容量は目標の曲数から決まる", () => {
  assertEquals(ubSongCapacity(manifest).songCount, 120);
});

Deno.test("曲のオーバーレイ欄は配置計画のDATA1 indexで埋まる", () => {
  const [entry] = input().content.songs;
  const packages = new DataView(entry.overlayFields.packages.buffer);
  assertEquals(packages.getUint16(0, true), 1500);
  assertEquals(entry.targetSongIndex, 200);
});

Deno.test("組を持たない曲が無ければ、記述子のキーを作らない", () => {
  assertEquals("pairlessSongs" in input().content, false);
});

Deno.test("配置はそのまま渡す", () => {
  const result = input();
  assertEquals(result.placement.data1BaseLba, 50);
  assertEquals(result.placement.overlayPackages[0].newData1Index, 1500);
});

Deno.test("全曲リストで外した譜面は、曲DBへ渡すエントリで欄が0になる", () => {
  const entry = new Uint8Array(PB_ENTRY.size).fill(7);
  const excluded = {
    ...song,
    entry: PB_ENTRY.encode(entry),
    excludedCharts: ["sp_another"],
  };
  const [written] = ubElfInput({
    capacity: ubSongCapacity(manifest),
    manifest: { ...manifest, songs: [excluded] },
    plan,
    songSprites: new Map(),
    sourceElfOf: () => {
      throw new Error("実行ファイルは読まない");
    },
  }).content.songs;
  const view = new DataView(written.entry.buffer);
  assertEquals(written.entry[PB_ENTRY.levelFieldOffset("sp_another")], 0);
  assertEquals(
    view.getUint32(PB_ENTRY.chartFieldOffset("sp_another"), true),
    0,
  );
  const [notes] = PB_ENTRY.notesFieldOffsets("sp_another");
  assertEquals(view.getUint16(notes, true), 0);
  assertEquals(written.entry[PB_ENTRY.levelFieldOffset("sp_hyper")], 7);
});

/** PB原盤のsong3が、SP NORMAL(レベル5)の譜面だけを持つELF */
function pbElfWithNormal(): Uint8Array {
  const elf = new Uint8Array(
    PB_ENTRY.definition.songDbBase + 4 * PB_ENTRY.size,
  );
  const entry = elf.subarray(
    PB_ENTRY.definition.songDbBase + 3 * PB_ENTRY.size,
  );
  entry[PB_ENTRY.levelFieldOffset("sp_normal")] = 5;
  new DataView(entry.buffer, entry.byteOffset)
    .setUint16(PB_ENTRY.notesFieldOffsets("sp_normal")[0], 300, true);
  return elf;
}

const inputWithPbLevels = (levels: Record<string, number>) =>
  ubElfInput({
    capacity: ubSongCapacity(manifest),
    manifest: { ...manifest, pbLevels: [{ levels, songIndex: 3 }] },
    plan,
    songSprites: new Map(),
    sourceElfOf: pbElfWithNormal,
  });

Deno.test("PB原盤の曲は、全曲リストの難易度を書き込んだレベル欄を書く", () => {
  const [field] = inputWithPbLevels({ sp_normal: 6 }).content.pbLevels ?? [];
  assertEquals(field.songIndex, 3);
  assertEquals(
    field.levels[difficultyOf("sp_normal").levelIndex],
    6,
  );
  assertEquals(field.levels.length, 10);
});

Deno.test("PB原盤の曲に無い譜面へ難易度を書くと、曲番号を付けて止まる", () => {
  assertThrows(
    () => inputWithPbLevels({ sp_another: 9 }),
    Error,
    "pb song3",
  );
});

Deno.test("PB原盤の曲と共有する曲は、その曲のオーバーレイ欄をそのまま写す", () => {
  const elf = new Uint8Array(
    PB_ENTRY.definition.songDbBase + 4 * PB_ENTRY.size,
  );
  const pbEntry = elf.subarray(
    PB_ENTRY.definition.songDbBase + 3 * PB_ENTRY.size,
  );
  const view = new DataView(pbEntry.buffer, pbEntry.byteOffset);
  view.setUint16(0x64, 1453, true);
  view.setUint16(0x74, 2, true);
  view.setUint16(0x76, 1453, true);
  const [entry] = ubElfInput({
    capacity: ubSongCapacity(manifest),
    manifest: {
      ...manifest,
      songs: [{ ...song, sharedWith: { targetSongIndex: 3 } }],
    },
    plan,
    songSprites: new Map(),
    sourceElfOf: () => elf,
  }).content.songs;
  const packages = new DataView(entry.overlayFields.packages.buffer);
  const pairs = new DataView(entry.overlayFields.pairs.buffer);
  assertEquals(packages.getUint16(0, true), 1453);
  assertEquals(pairs.getUint16(0, true), 2);
  assertEquals(pairs.getUint16(2, true), 1453);
});

Deno.test("配置計画とmanifestのABC件数が違えば例外を投げる", () => {
  assertThrows(
    () =>
      ubElfInput({
        capacity: ubSongCapacity(manifest),
        manifest: { ...manifest, expectedNewAbcCount: 1 },
        plan,
        songSprites: new Map(),
        sourceElfOf: () => {
          throw new Error("実行ファイルは読まない");
        },
      }),
    Error,
    "ABC件数が一致しない",
  );
});
