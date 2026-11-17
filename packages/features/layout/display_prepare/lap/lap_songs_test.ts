// 実行: deno test packages/features/layout/display_prepare/lap/lap_songs_test.ts
// 周回で整えた曲名カードとオーバーレイを、曲ごとに残して当てはめることを確かめる。値はすべて作り物である。

import { assertEquals, assertThrows } from "@std/assert";
import { generatedSourceArchive, type ManifestSong } from "@csa/core";
import { applyLapDisplay, lapDisplaySongs } from "./lap_songs.ts";

const file = (path: string) => generatedSourceArchive("file", path);

const songOf = (
  songId: number,
  fields: Partial<ManifestSong> = {},
): ManifestSong => ({
  assets: [],
  canonicalKey: `k${songId}`,
  entry: "",
  overlay: {
    packages: [{ sourceArchive: "DATA1.DAT" }],
  } as ManifestSong["overlay"],
  sourceGeneration: "9th",
  sourceSongIndex: songId,
  targetSongIndex: songId,
  title: `t${songId}`,
  titleCard: { sourceArchive: "DATA1.DAT" } as ManifestSong["titleCard"],
  videoFields: [],
  ...fields,
});

Deno.test("使うファイルは、分ける前と分けた後の参照を重ねずに集める", () => {
  const repacked = songOf(1, {
    overlay: {
      packages: [{ sourceArchive: file("o/0001.if") }],
    } as ManifestSong["overlay"],
    titleCard: { sourceArchive: file("t/0001.if") } as ManifestSong[
      "titleCard"
    ],
  });
  const split = songOf(1, {
    overlay: {
      packages: [
        { sourceArchive: file("o/0001_0.if") },
        { sourceArchive: file("o/0001_1.if") },
      ],
    } as ManifestSong["overlay"],
    titleCard: repacked.titleCard,
  });
  const songs = lapDisplaySongs([split], [repacked], new Set(["9th/1"]));
  assertEquals(songs.get("9th/1")?.files, [
    "t/0001.if",
    "o/0001.if",
    "o/0001_0.if",
    "o/0001_1.if",
  ]);
  assertEquals(songs.get("9th/1")?.dropped, true);
});

Deno.test("当てはめても、元の曲のキーの位置は変えない", () => {
  const lap = songOf(2, {
    titleCard: { sourceArchive: file("t/0002.if") } as ManifestSong[
      "titleCard"
    ],
  });
  const lapSongs = lapDisplaySongs([lap], [lap], new Set());
  const applied = applyLapDisplay([songOf(2, { entry: "e" })], lapSongs);
  assertEquals(
    Object.keys(applied.songs[0]),
    Object.keys(songOf(2)),
  );
  assertEquals(applied.songs[0].titleCard, lap.titleCard);
  assertEquals(applied.songs[0].entry, "e");
  assertEquals(applied.files, ["t/0002.if"]);
});

Deno.test("周回の結果が無い曲は、例外にする", () => {
  assertThrows(() => applyLapDisplay([songOf(3)], new Map()), Error, "9th/3");
});
