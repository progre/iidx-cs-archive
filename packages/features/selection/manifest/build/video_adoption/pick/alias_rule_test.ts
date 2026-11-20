// 別名から採る1本と、曲ごとの採用の行を作る規則。ダミーの曲の行で確かめる。

import { assertEquals } from "@std/assert";
import { aliasAdoptionsOf, aliasPickerOf } from "./alias_rule.ts";
import { sourcesOf, videoAsset } from "../testing.ts";

const video = (sourceFileIndex: number, sourceOffset: number) => ({
  ...videoAsset(sourceOffset, 240),
  sourceFileIndex,
});

const rulesOf = (aliases: [string, string][]) => ({
  aliases: new Map(aliases),
  convertsVideo: (generation: string) =>
    ["5th", "6th", "7th"].includes(generation),
  generations: ["5th", "6th", "7th", "9th", "10th"],
  preferredConvertedGeneration: "6th",
});

Deno.test("PBの曲が単独で持つムービーを、最初に選ぶ", () => {
  const sources = sourcesOf(
    [{ generation: "9th", songId: 1, asset: video(10, 100) }],
    new Map(),
    [{ song_id: 5, videos: [800] }],
  );
  const pick = aliasPickerOf(
    rulesOf([["9th:10", "a"], ["pb:800", "a"]]),
    sources,
  );
  assertEquals(pick("a"), { generation: "pb", id: 800 });
});

Deno.test("PBに無ければ、変換しない世代のいちばん古いムービーを選ぶ", () => {
  const sources = sourcesOf(
    [
      { generation: "7th", songId: 1, asset: video(70, 100) },
      { generation: "10th", songId: 2, asset: video(600, 200) },
      { generation: "9th", songId: 3, asset: video(90, 300) },
    ],
    new Map(),
    [],
  );
  const pick = aliasPickerOf(
    rulesOf([["7th:70", "a"], ["10th:600", "a"], ["9th:90", "a"]]),
    sources,
  );
  assertEquals(pick("a"), { generation: "9th", id: 90 });
});

Deno.test("変換する世代しか無ければ、表の先頭の行のムービーを選ぶ", () => {
  const sources = sourcesOf(
    [{ generation: "7th", songId: 1, asset: video(70, 100) }],
    new Map(),
    [],
  );
  const pick = aliasPickerOf(rulesOf([["7th:70", "a"]]), sources);
  assertEquals(pick("a"), { generation: "7th", id: 70 });
});

Deno.test("変換する世代しか無ければ、優先する世代のムービーを表の先頭より先に選ぶ", () => {
  const sources = sourcesOf(
    [
      { generation: "5th", songId: 1, asset: video(50, 100) },
      { generation: "6th", songId: 2, asset: video(60, 200) },
      { generation: "7th", songId: 3, asset: video(70, 300) },
    ],
    new Map(),
    [],
  );
  const pick = aliasPickerOf(
    rulesOf([["5th:50", "a"], ["6th:60", "a"], ["7th:70", "a"]]),
    sources,
  );
  assertEquals(pick("a"), { generation: "6th", id: 60 });
});

Deno.test("別名のムービーを使う曲に、別名の1本を使う行を作る。`_short`は元の別名を使う", () => {
  const sources = sourcesOf(
    [
      { generation: "9th", songId: 1, asset: video(90, 100) },
      { generation: "10th", songId: 2, asset: video(600, 200) },
      { generation: "10th", songId: 3, asset: video(610, 300) },
    ],
    new Map(),
    [],
  );
  const rules = rulesOf([
    ["9th:90", "a"],
    ["10th:600", "a"],
    ["10th:610", "a_short"],
  ]);
  assertEquals(
    aliasAdoptionsOf(rules, aliasPickerOf(rules, sources), sources),
    [
      { song: { generation: "10th", songId: 2 }, slot: 0, alias: "a" },
      { song: { generation: "10th", songId: 3 }, slot: 0, alias: "a" },
    ],
  );
});

Deno.test("何本目かは、ファイル番号の順ではなく曲DBの欄の順で数える", () => {
  const second = { ...video(829, 300), fields: ["1"] };
  const sources = sourcesOf(
    [
      { generation: "9th", songId: 1, asset: video(90, 100) },
      { generation: "10th", songId: 2, asset: video(834, 200) },
      { generation: "10th", songId: 2, asset: second },
    ],
    new Map(),
    [],
  );
  const rules = rulesOf([["9th:90", "a"], ["10th:829", "a"]]);
  assertEquals(
    aliasAdoptionsOf(rules, aliasPickerOf(rules, sources), sources),
    [{ song: { generation: "10th", songId: 2 }, slot: 1, alias: "a" }],
  );
});
