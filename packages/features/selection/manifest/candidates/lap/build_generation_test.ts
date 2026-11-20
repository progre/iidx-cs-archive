import type { Listing } from "../rows/mod.ts";
import { listing, songmapSong, sourceFile } from "../testing.ts";
import { assertEquals } from "@std/assert";
import { buildGeneration } from "./build_generation.ts";

const LISTED = listing();

const rowsOf = (listingOf: (songId: number) => Listing | undefined) =>
  buildGeneration(
    "10th",
    "era2",
    {
      files: [sourceFile(1), sourceFile(2), sourceFile(3)],
      songs: [songmapSong(1), songmapSong(2), songmapSong(3)],
    },
    {
      readResolution: () => Promise.reject(new Error("読まない")),
      sameBytes: () => Promise.reject(new Error("読まない")),
    },
    (song) => "KEY" + song.song_id,
    (songId) => {
      const found = listingOf(songId);
      return found === undefined ? [] : [found];
    },
    new Map(),
  );

Deno.test("各行のキーには、曲の索引キーを使う", async () => {
  const rows = await rowsOf(() => LISTED);
  assertEquals(rows.map((row) => row.canonicalKey), ["KEY1", "KEY2", "KEY3"]);
});

Deno.test("全曲リストに行が無い曲は、行にしない", async () => {
  const rows = await rowsOf((songId) => songId === 2 ? undefined : LISTED);
  assertEquals(rows.map((row) => row.sourceSongIndex), [1, 3]);
});

Deno.test("excludeを書いた曲は、除外の印とメモを持つ", async () => {
  const rows = await rowsOf((songId) =>
    songId === 3 ? { ...LISTED, excluded: true, note: "外す" } : LISTED
  );
  assertEquals(rows.map((row) => row.excluded), [undefined, undefined, true]);
  assertEquals(rows.at(2)?.note, "外す");
});

Deno.test("収録する曲も、全曲リストのメモを持つ", async () => {
  const rows = await rowsOf((songId) =>
    songId === 3 ? { ...LISTED, note: "メモ" } : LISTED
  );
  assertEquals(rows.map((row) => row.note), [undefined, undefined, "メモ"]);
});

Deno.test("行の5鍵盤版を書く。裏の条件は周回の後に書くので、周回の行は持たない", async () => {
  const rows = await rowsOf((songId) =>
    songId === 3 ? { ...LISTED, fiveKeyOf: { songId: 1 } } : LISTED
  );
  assertEquals(rows.map((row) => row.variantOf), [
    undefined,
    undefined,
    undefined,
  ]);
  assertEquals(rows.map((row) => row.fiveKeyOf), [
    undefined,
    undefined,
    { songId: 1 },
  ]);
});
