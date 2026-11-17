import { assertEquals } from "@std/assert";
import { buildSongIndex } from "./build.ts";
import { compareCodePoints, titleKeyOf } from "./build.ts";
import type { IndexSource, IndexTitleOf } from "./types.ts";

const songOf = (song_id: number, title: string): IndexSource => ({
  song_id,
  title,
  charts: {},
  keysound: null,
  bgm: null,
  videos: [],
});

const NONE: IndexTitleOf = () => null;

Deno.test("曲名は、全角と半角と大文字小文字と記号の違いを吸収して結合する", () => {
  const index = buildSongIndex(
    [
      { generation: "9th", songs: [songOf(0, "Ｓample Song!")] },
      { generation: "pb", songs: [songOf(3, "SAMPLE  SONG")] },
    ],
    NONE,
  );
  assertEquals(index.generations, ["9th", "pb"]);
  assertEquals(Object.keys(index.songs), ["SAMPLESONG"]);
  const entry = index.songs["SAMPLESONG"];
  assertEquals(entry.titles, ["Ｓample Song!", "SAMPLE  SONG"]);
  assertEquals(Object.keys(entry.generations), ["9th", "pb"]);
});

Deno.test("索引の曲名を書いた曲は、その曲名で結合する", () => {
  const index = buildSongIndex(
    [
      { generation: "gold", songs: [songOf(1, "SAM"), songOf(2, "SAM")] },
      { generation: "pb", songs: [songOf(4, "SAMPLE SONG")] },
    ],
    (generation, songId) =>
      generation === "gold" && songId === 1 ? "SAMPLE SONG" : null,
  );
  assertEquals(
    Object.keys(index.songs["SAMPLESONG"].generations),
    ["gold", "pb"],
  );
  assertEquals(index.songs["SAM"].generations.gold.map((e) => e.song_id), [2]);
});

Deno.test("同じ世代で同じキーの曲は配列に並び、キーが空の曲は索引に載らない", () => {
  const index = buildSongIndex(
    [{
      generation: "us",
      songs: [songOf(0, "A-B"), songOf(1, "AB"), songOf(2, "!!")],
    }],
    NONE,
  );
  assertEquals(index.songs["AB"].generations.us.map((e) => e.song_id), [0, 1]);
  assertEquals(Object.keys(index.songs), ["AB"]);
});

Deno.test("索引のキーは符号位置の順で、数字だけのキーも読み戻した並びになる", () => {
  const index = buildSongIndex(
    [{
      generation: "us",
      songs: [songOf(0, "b"), songOf(1, "10"), songOf(2, "2"), songOf(3, "a")],
    }],
    NONE,
  );
  // 整数のキーは、オブジェクトでは先頭に昇順で並ぶ。JSONを読み戻した場合と同じ
  assertEquals(Object.keys(index.songs), ["2", "10", "A", "B"]);
});

Deno.test("符号位置の順は、補助面の文字をBMPの高い文字の後ろに置く", () => {
  assertEquals(compareCodePoints("Ａ", "\u{20000}") < 0, true);
  assertEquals("Ａ" < "\u{20000}", false);
  assertEquals(compareCodePoints("ab", "a"), 1);
});

Deno.test("日本語の題名はキーに残る", () => {
  assertEquals(titleKeyOf("ＡＢＣ　あい～う"), "ABCあいう");
});
