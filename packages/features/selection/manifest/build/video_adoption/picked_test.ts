// 別名で書いた差し替え表の行を、採用元の曲と何本目かに引き直す。ダミーの曲の行で確かめる。

import { assertEquals, assertThrows } from "@std/assert";
import { adoptionsOf } from "./picked.ts";
import { sourcesOf, videoAsset } from "./testing.ts";

const song = { generation: "8th", songId: 88 };
const video = (sourceFileIndex: number, sourceOffset: number) => ({
  ...videoAsset(sourceOffset, 240),
  sourceFileIndex,
});

Deno.test("採用元の曲を書いた行は、そのまま返す", () => {
  const row = {
    song,
    slot: 0,
    adopt: { generation: "red", songId: 3 },
    adoptSlot: 1,
  };
  assertEquals(adoptionsOf([row], new Map(), sourcesOf([], new Map())), [row]);
});

Deno.test("別名は、pickの1本を持つ曲と、その曲の何本目かに引き直す", () => {
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
      new Map([["7th_techno", { generation: "red", id: 835 }]]),
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
      new Map([["7th_techno", { generation: "pb", id: 800 }]]),
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

Deno.test("pickの無い別名は止まる", () => {
  assertThrows(
    () =>
      adoptionsOf(
        [{ song, slot: 0, alias: "7th_techno" }],
        new Map(),
        sourcesOf([], new Map()),
      ),
    Error,
    "7th_technoのpick",
  );
});

Deno.test("pickの1本を持つ曲が載せる候補に無ければ止まる", () => {
  assertThrows(
    () =>
      adoptionsOf(
        [{ song, slot: 0, alias: "7th_techno" }],
        new Map([["7th_techno", { generation: "red", id: 835 }]]),
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
        new Map([["7th_techno", { generation: "pb", id: 800 }]]),
        sources,
      ),
    Error,
    "印が違う",
  );
});
