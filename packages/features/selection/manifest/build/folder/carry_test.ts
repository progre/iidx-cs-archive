// 全世代の曲DBの行と、管理名ごとの作品番号の集め方。
// 実行: deno test packages/features/selection/manifest/build/folder/carry_test.ts

import { assertEquals } from "@std/assert";
import {
  type CarriedSong,
  folderCarry,
  oldSongKeys,
  songRows,
  songsByGeneration,
} from "./carry.ts";
import type { IndexDoc } from "../../index/mod.ts";

const index = {
  songs: {
    A: { generations: { "3rd": [{ song_id: 1 }], "pb": [{ song_id: 5 }] } },
    B: { generations: { "3rd": [{ song_id: 2 }] } },
  },
} as unknown as IndexDoc;

const songs = songsByGeneration(index);

Deno.test("索引を世代ごとの曲の一覧にする", () => {
  assertEquals(songs.get("3rd"), [
    { key: "A", songId: 1 },
    { key: "B", songId: 2 },
  ]);
  assertEquals(songs.get("pb"), [{ key: "A", songId: 5 }]);
});

Deno.test("曲DBの値を、世代とsong_idで引いた行にする", () => {
  const rows = songRows(
    songs,
    (generation, songId) => generation === "pb" ? songId : undefined,
    (_generation, songId) => songId * 10,
  );
  assertEquals(rows, [
    {
      canonicalKey: "A",
      sourceGeneration: "3rd",
      newOld: 10,
      sourceSongIndex: 1,
      sourceVersion: undefined,
    },
    {
      canonicalKey: "B",
      sourceGeneration: "3rd",
      newOld: 20,
      sourceSongIndex: 2,
      sourceVersion: undefined,
    },
    {
      canonicalKey: "A",
      sourceGeneration: "pb",
      newOld: 50,
      sourceSongIndex: 5,
      sourceVersion: 5,
    },
  ]);
});

Deno.test("旧曲の印が付いた曲について、管理名を集める", () => {
  const marks = new Map([["3rd/1", 0], ["3rd/2", 1]]);
  const keys = oldSongKeys(
    "3rd",
    songs,
    (generation, songId) => marks.get(generation + "/" + songId),
    (_generation, mark) => mark === 0 ? undefined : 3,
  );
  assertEquals([...keys], ["A"]);
});

Deno.test("印を読めない世代の旧曲は空である", () => {
  const keys = oldSongKeys("pb", songs, () => undefined, () => undefined);
  assertEquals(keys.size, 0);
});

Deno.test("決められない行を除き、管理名ごとに作品番号と世代を集める", () => {
  const rows: CarriedSong[] = [
    { canonicalKey: "A", sourceGeneration: "3rd", sourceSongIndex: 1 },
    { canonicalKey: "A", sourceGeneration: "pb", sourceSongIndex: 5 },
    { canonicalKey: "B", sourceGeneration: "3rd", sourceSongIndex: 2 },
  ];
  const carry = folderCarry(
    rows,
    (row) => row.canonicalKey === "A" ? 2 : undefined,
  );
  assertEquals(carry.get("A")?.get(2), ["3rd", "pb"]);
  assertEquals(carry.has("B"), false);
});
