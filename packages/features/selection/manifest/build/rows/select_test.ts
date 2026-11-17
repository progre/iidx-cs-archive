// manifestに載せる行の選抜。
// 実行: deno test packages/features/selection/manifest/build/rows/select_test.ts

import type { ManifestSongDraft } from "@csa/core";
import { assertEquals } from "@std/assert";
import {
  fiveKeyKey,
  manifestOrderOfGeneration,
  rowKey,
  type SelectionInput,
  selectSongs,
  songKey,
  targetSongCountOf,
} from "./select.ts";

const GENERATIONS = ["9th", "red", "emp"];

const song = (
  generation: string,
  songId: number,
  rest: Partial<ManifestSongDraft> = {},
): ManifestSongDraft => ({
  sourceAssets: [],
  canonicalKey: "song" + songId,
  sourceGeneration: generation,
  sourceSongIndex: songId,
  title: "song",
  ...rest,
});

const inputOf = (
  buildable: ManifestSongDraft[],
  rest: Partial<SelectionInput> = {},
): SelectionInput => ({
  buildable,
  generations: GENERATIONS,
  isPlayable: () => true,
  ...rest,
});

const keys = (rows: ManifestSongDraft[]) => rows.map(songKey);

Deno.test("世代の発売順、song_idの順に並べる", () => {
  const rows = [song("emp", 1), song("9th", 2), song("9th", 1)];
  assertEquals(keys(selectSongs(inputOf(rows)).selected), [
    "9th/1",
    "9th/2",
    "emp/1",
  ]);
});

Deno.test("原作のムービーを置けない曲は後ろへ回る", () => {
  const rows = [song("9th", 1), song("emp", 1)];
  const selection = selectSongs(
    inputOf(rows, { isPlayable: (row) => row.sourceGeneration === "emp" }),
  );
  assertEquals(keys(selection.selected), ["emp/1", "9th/1"]);
});

Deno.test("表が選外の5鍵盤版は外し、裏エントリーは別に返す", () => {
  const front = song("9th", 1);
  const fiveKey = song("9th", 2, { fiveKeyOf: { songId: 1 } });
  const back = song("9th", 3, { variantOf: { rule: "random8", songId: 1 } });
  const selection = selectSongs(inputOf([front, back]));
  assertEquals(keys(selection.selected), ["9th/1"]);
  assertEquals(keys(selection.variants), ["9th/3"]);
  assertEquals(fiveKeyKey(fiveKey), "9th/1");
  const only = selectSongs(inputOf([fiveKey]));
  assertEquals(keys(only.detached), ["9th/2"]);
  assertEquals(only.selected, []);
});

Deno.test("PB原盤の曲を表にする5鍵盤版は、PBの曲が常に載るので外さない", () => {
  const fiveKey = song("emp", 2, {
    fiveKeyOf: { generation: "pb", ownLevels: true, songId: 89 },
  });
  assertEquals(keys(selectSongs(inputOf([fiveKey])).selected), ["emp/2"]);
});

Deno.test("曲DBの曲数は、収録する曲数に99を足した数である。99はPBの固定枠の数", () => {
  assertEquals(targetSongCountOf(5), 104);
});

Deno.test("1世代の並びは、再生できる表の曲、できない表の曲、裏エントリーの順になる", () => {
  const rows = [
    song("9th", 4, { variantOf: { rule: "random8", songId: 1 } }),
    song("9th", 3),
    song("9th", 2, { excluded: true }),
    song("9th", 1),
    song("9th", 5),
  ];
  const playable = (row: ManifestSongDraft) => row.sourceSongIndex !== 1;
  assertEquals(keys(manifestOrderOfGeneration(rows, playable)), [
    "9th/3",
    "9th/5",
    "9th/1",
    "9th/4",
  ]);
});

Deno.test("全曲リストで2行に書いた曲の行は、全曲リストの行番号で見分ける", () => {
  const listed = song("red", 80, { catalogLine: 3 });
  const back = song("red", 80, {
    catalogLine: 4,
    variantOf: { generation: "dd", rule: "custom", songId: 74 },
  });
  assertEquals([rowKey(listed), rowKey(back)], ["red/80@3", "red/80@4"]);
});
