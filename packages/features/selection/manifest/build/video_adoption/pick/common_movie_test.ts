// 全曲リストの`common_movie`の組のキーから作る別名。ダミーの曲の行で確かめる。

import { assertEquals, assertThrows } from "@std/assert";
import { withCommonMovieAliases } from "./common_movie.ts";
import { sourcesOf, videoAsset } from "../testing.ts";

const video = (sourceFileIndex: number, sourceOffset: number) => ({
  ...videoAsset(sourceOffset, 240),
  sourceFileIndex,
});

/** `marked`の曲は`*`、`groups`の曲はその値を、`common_movie`に書いたものとする */
const rulesOf = (
  marked: string[],
  keys: Record<string, string>,
  aliases: [string, string][] = [],
  groups: Record<string, string> = {},
) => ({
  aliases: new Map(aliases),
  commonMovieOf: (
    { generation, songId }: { generation: string; songId: number },
  ) => {
    const song = `${generation}/${songId}`;
    return groups[song] ?? (marked.includes(song) ? "*" : undefined);
  },
  generations: ["7th", "9th", "10th"],
  songKeyOf: ({ generation, songId }: { generation: string; songId: number }) =>
    keys[`${generation}/${songId}`],
});

Deno.test("`*`以外の値は、曲名が違っても、値が同じ曲どうしを組にする", () => {
  const sources = sourcesOf(
    [
      { generation: "7th", songId: 1, asset: video(70, 100) },
      { generation: "9th", songId: 3, asset: video(90, 300) },
      { generation: "10th", songId: 2, asset: video(600, 200) },
    ],
    new Map(),
    [],
  );
  const rules = rulesOf(
    ["10th/2"],
    { "7th/1": "A", "9th/3": "B", "10th/2": "A" },
    [],
    { "7th/1": "AB", "9th/3": "AB" },
  );
  assertEquals(
    [...withCommonMovieAliases(rules, sources)],
    [["7th:70", "common:AB"], ["9th:90", "common:AB"]],
  );
});

Deno.test("印を付けた同じ曲名の曲のムービーに、発売順で別名を付ける", () => {
  const sources = sourcesOf(
    [
      { generation: "10th", songId: 2, asset: video(600, 200) },
      { generation: "7th", songId: 1, asset: video(70, 100) },
    ],
    new Map(),
    [{ song_id: 5, videos: [800] }],
  );
  const rules = rulesOf(
    ["7th/1", "10th/2", "pb/5"],
    { "7th/1": "A", "10th/2": "A", "pb/5": "A" },
  );
  assertEquals(
    [...withCommonMovieAliases(rules, sources)],
    [["7th:70", "song:A"], ["10th:600", "song:A"], ["pb:800", "song:A"]],
  );
});

Deno.test("印の無い曲と、同じ曲名の相手がいない曲には、別名を付けない", () => {
  const sources = sourcesOf(
    [
      { generation: "7th", songId: 1, asset: video(70, 100) },
      { generation: "9th", songId: 3, asset: video(90, 300) },
      { generation: "10th", songId: 2, asset: video(600, 200) },
    ],
    new Map(),
    [],
  );
  const rules = rulesOf(
    ["7th/1", "9th/3"],
    { "7th/1": "A", "9th/3": "B", "10th/2": "A" },
  );
  assertEquals([...withCommonMovieAliases(rules, sources)], []);
});

Deno.test("表で別名を付けたムービーは、表の別名のままにする", () => {
  const sources = sourcesOf(
    [
      { generation: "7th", songId: 1, asset: video(70, 100) },
      { generation: "9th", songId: 3, asset: video(90, 300) },
      { generation: "10th", songId: 2, asset: video(600, 200) },
    ],
    new Map(),
    [],
  );
  const rules = rulesOf(
    ["7th/1", "9th/3", "10th/2"],
    { "7th/1": "A", "9th/3": "A", "10th/2": "A" },
    [["10th:600", "generic"]],
  );
  assertEquals(
    [...withCommonMovieAliases(rules, sources)],
    [["10th:600", "generic"], ["7th:70", "song:A"], ["9th:90", "song:A"]],
  );
});

Deno.test("1本のムービーに、曲名の違う別名が2つ付くときは止める", () => {
  const sources = sourcesOf(
    [
      { generation: "7th", songId: 1, asset: video(70, 100) },
      { generation: "7th", songId: 4, asset: video(70, 100) },
      { generation: "9th", songId: 3, asset: video(90, 300) },
      { generation: "10th", songId: 2, asset: video(600, 200) },
    ],
    new Map(),
    [],
  );
  const rules = rulesOf(
    ["7th/1", "7th/4", "9th/3", "10th/2"],
    { "7th/1": "A", "9th/3": "A", "7th/4": "B", "10th/2": "B" },
  );
  assertThrows(() => withCommonMovieAliases(rules, sources), Error, "7th:70");
});
