// 別名で書いた採用の行を、採用元の曲と何本目かに引き直す。ダミーの曲の行で確かめる。

import { assertEquals, assertThrows } from "@std/assert";
import { adoptionsOf } from "./picked.ts";
import { sourcesOf, videoAsset } from "../testing.ts";

const song = { generation: "8th", songId: 88 };
const video = (sourceFileIndex: number, sourceOffset: number) => ({
  ...videoAsset(sourceOffset, 240),
  sourceFileIndex,
});

/** 7th_technoだけに1本がある、規則の代わり */
const pickOf = (movie: { generation: string; id: number }) => (alias: string) =>
  alias === "7th_techno" ? movie : undefined;

Deno.test("別名は、選んだ1本を持つ曲と、その曲の何本目かに引き直す", () => {
  const sources = sourcesOf(
    [
      { generation: "red", songId: 3, asset: video(830, 100) },
      { generation: "red", songId: 3, asset: video(835, 200) },
    ],
    new Map(),
  );
  assertEquals(
    adoptionsOf(
      [{ song, slot: 0, alias: "7th_techno" }],
      pickOf({ generation: "red", id: 835 }),
      sources,
    ),
    [{
      song,
      slot: 0,
      adopt: { generation: "red", songId: 3 },
      adoptSlot: 1,
    }],
  );
});

Deno.test("PBの1本は、そのABC indexを持つPBの曲に引き直す", () => {
  const sources = sourcesOf([], new Map(), [{ song_id: 5, videos: [800] }]);
  assertEquals(
    adoptionsOf(
      [{ song, slot: 0, alias: "7th_techno" }],
      pickOf({ generation: "pb", id: 800 }),
      sources,
    ),
    [{
      song,
      slot: 0,
      adopt: { generation: "pb", songId: 5 },
      adoptSlot: 0,
    }],
  );
});

Deno.test("採れるムービーが無い別名は止まる", () => {
  assertThrows(
    () =>
      adoptionsOf(
        [{ song, slot: 0, alias: "7th_techno" }],
        () => undefined,
        sourcesOf([], new Map()),
      ),
    Error,
    "別名7th_technoに、CSAが採れるムービーが無い",
  );
});

Deno.test("選んだ1本を持つ曲が載せる候補に無ければ止まる", () => {
  assertThrows(
    () =>
      adoptionsOf(
        [{ song, slot: 0, alias: "7th_techno" }],
        pickOf({ generation: "red", id: 835 }),
        sourcesOf([], new Map()),
      ),
    Error,
    "red:835",
  );
});

Deno.test("PBの1本を持つ曲どうしでムービーの印が違えば止まる", () => {
  const sources = sourcesOf(
    [],
    new Map([["pb/5", 0x01]]),
    [{ song_id: 5, videos: [800] }, { song_id: 6, videos: [800] }],
  );
  assertThrows(
    () =>
      adoptionsOf(
        [{ song, slot: 0, alias: "7th_techno" }],
        pickOf({ generation: "pb", id: 800 }),
        sources,
      ),
    Error,
    "印が違う",
  );
});
