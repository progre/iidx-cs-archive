// 曲indexの割り当てと、表の曲との結び付け。

import type { ManifestSongDraft } from "@csa/core";
import { assertEquals } from "@std/assert";
import { plannedSongs } from "./links.ts";

const song = (
  generation: string,
  songId: number,
  rest: Partial<ManifestSongDraft> = {},
): ManifestSongDraft => ({
  canonicalKey: "song" + songId,
  sourceAssets: [],
  sourceGeneration: generation,
  sourceSongIndex: songId,
  title: "song",
  ...rest,
});

Deno.test("選曲リストの曲は99から、裏エントリーは目標曲数から割り当てる", () => {
  const front = song("9th", 1);
  const fiveKey = song("9th", 2, { fiveKeyOf: { songId: 1 } });
  const back = song("9th", 3, { variantOf: { rule: "random8", songId: 1 } });
  const planned = plannedSongs(
    { selected: [front, fiveKey], variants: [back] },
    120,
  );
  assertEquals(planned.map((each) => each.targetSongIndex), [99, 100, 120]);
  assertEquals(planned[0].fiveKeyOf, undefined);
  assertEquals(planned[1].fiveKeyOf, { songId: 1, targetSongIndex: 99 });
  assertEquals(planned[2].variantOf, {
    rule: "random8",
    songId: 1,
    targetSongIndex: 99,
  });
});

Deno.test("差し替え元の表が選ばれていない裏エントリーは載せない", () => {
  const back = song("9th", 3, { variantOf: { rule: "random8", songId: 1 } });
  assertEquals(
    plannedSongs({ selected: [song("9th", 2)], variants: [back] }, 120)
      .length,
    1,
  );
});

Deno.test("PB原盤の曲を表にする裏エントリーは、PBのsong_idの枠と結ぶ", () => {
  const back = song("hs", 51, {
    variantOf: { generation: "pb", rule: "alternate", songId: 34 },
  });
  const planned = plannedSongs({ selected: [], variants: [back] }, 120);
  assertEquals(planned.map((each) => each.targetSongIndex), [120]);
  assertEquals(planned[0].variantOf?.targetSongIndex, 34);
});

Deno.test("PB原盤の曲を表にする5鍵盤版は、PBのsong_idの枠と結ぶ", () => {
  const fiveKey = song("djt", 100, {
    fiveKeyOf: { generation: "pb", songId: 89 },
  });
  const planned = plannedSongs({ selected: [fiveKey], variants: [] }, 120);
  assertEquals(planned[0].fiveKeyOf?.targetSongIndex, 89);
});

Deno.test("直前の曲が選ばれていれば、その枠を条件に書く", () => {
  const first = song("9th", 1);
  const second = song("9th", 2);
  const back = song("9th", 3, {
    variantOf: { afterSongId: 2, rule: "previousSong", songId: 1 },
  });
  const planned = plannedSongs(
    { selected: [first, second], variants: [back] },
    120,
  );
  assertEquals(planned[2].variantOf?.afterTargetSongIndex, 100);
  assertEquals(planned[2].variantOf?.targetSongIndex, 99);
});

Deno.test("直前の曲が選外なら、条件の枠を書かない", () => {
  const back = song("9th", 3, {
    variantOf: { afterSongId: 9, rule: "previousSong", songId: 1 },
  });
  const planned = plannedSongs(
    { selected: [song("9th", 1)], variants: [back] },
    120,
  );
  assertEquals(planned[1].variantOf?.afterTargetSongIndex, undefined);
  assertEquals(planned[1].variantOf?.targetSongIndex, 99);
});

Deno.test("別の世代の曲を表にする裏エントリーは、その世代の選んだ曲の枠と結ぶ", () => {
  const back = song("5th", 3, {
    variantOf: { generation: "7th", rule: "custom", songId: 8 },
  });
  const planned = plannedSongs(
    { selected: [song("5th", 8), song("7th", 8)], variants: [back] },
    120,
  );
  assertEquals(planned[2].variantOf?.targetSongIndex, 100);
});

Deno.test("PBの枠を使う表の曲はその枠に置き、99からの連番に数えない", () => {
  const front = song("7th", 43, { pbSlot: 91 });
  const other = song("9th", 1);
  const back = song("3rd", 12, {
    variantOf: { generation: "7th", rule: "custom", songId: 43 },
  });
  const planned = plannedSongs(
    { selected: [front, other], variants: [back] },
    120,
  );
  assertEquals(planned.map((each) => each.targetSongIndex), [91, 99, 120]);
  assertEquals(planned[2].variantOf?.targetSongIndex, 91);
});
