// 曲DBエントリのファイル参照を、資産の一覧にまとめる判断。
// 実行: deno test packages/features/selection/manifest/song/assets_test.ts

import { assertEquals, assertThrows } from "@std/assert";
import type { SongmapSong } from "@csa/core";
import { type EntryFileReferences, manifestAssetsOf } from "./assets.ts";

const files = [0, 1, 2, 3, 4].map((index) => ({
  archive: "A.DAT",
  index,
  offset: index * 100,
  size: 10 + index,
}));

const song = {
  song_id: 7,
  charts: { sp_hyper: { chart: 1, level: 5 } },
  sounds: [{ pair: "sp_hyper", keysound: 3, bgm: 4 }],
  videos: [2],
} as unknown as SongmapSong;

const field = (
  fieldOffset: number,
  fileIndex: number,
  width: "u16" | "u32",
) => ({
  fieldOffset,
  fileIndex,
  width,
});

const references: EntryFileReferences = {
  chart: [field(0xc0, 1, "u32")],
  sound: [field(0xe8, 3, "u16"), field(0xec, 4, "u16")],
  video: [field(0x58, 2, "u32")],
};

Deno.test("種別の順に並べ、songmapのファイルの位置を書く", () => {
  const { assets, videoFields } = manifestAssetsOf(
    song,
    files,
    references,
    false,
  );
  assertEquals(assets.map((asset) => asset.kind), [
    "chart",
    "video",
    "bgm",
    "keysound",
  ]);
  assertEquals(assets[1], {
    kind: "video",
    references: [{ fieldOffset: 0x58, width: "u32" }],
    sourceArchive: "A.DAT",
    sourceFileIndex: 2,
    sourceOffset: 200,
    sourceSize: 12,
  });
  assertEquals(videoFields, []);
});

Deno.test("動画を共有する曲は、動画を資産にせず、フィールドだけを返す", () => {
  const { assets, videoFields } = manifestAssetsOf(
    song,
    files,
    references,
    true,
  );
  assertEquals(assets.some((asset) => asset.kind === "video"), false);
  assertEquals(videoFields, [0x58]);
});

Deno.test("同じファイルを示すフィールドは、1つの資産に集める", () => {
  const { assets } = manifestAssetsOf(
    song,
    files,
    { ...references, chart: [field(0xc8, 1, "u32"), field(0xc0, 1, "u32")] },
    false,
  );
  assertEquals(
    assets[0].references.map((reference) => reference.fieldOffset),
    [0xc0, 0xc8],
  );
});

Deno.test("songmapの種別に無いファイルを示していたら止まる", () => {
  assertThrows(
    () =>
      manifestAssetsOf(
        song,
        files,
        { ...references, chart: [field(0xc0, 2, "u32")] },
        false,
      ),
    Error,
    "songmapのchartに無い",
  );
});

Deno.test("BGMともキー音とも決まらない音は止まる", () => {
  assertThrows(
    () =>
      manifestAssetsOf(
        song,
        files,
        { ...references, sound: [field(0xe8, 1, "u16")] },
        false,
      ),
    Error,
    "種別が一意でない",
  );
});
