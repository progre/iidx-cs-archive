// 裏エントリーと5鍵盤版の行を、表の曲の行に結ぶ処理を確かめる。

import { assertEquals, assertThrows } from "@std/assert";
import { assertBackFolders, withFrontsFirst } from "./relations.ts";
import type { VariantFor } from "../../types.ts";

/** 表の曲の行。`saveIndex`は曲indexである */
const front = (generation: string, songId: number, saveIndex: number) => ({
  generation,
  removed: false,
  saveIndex,
  songId,
});

/** `frontIndex`の曲の裏 */
const of = (
  frontIndex: number,
  rule: string,
  position?: number,
): VariantFor => ({
  front: "F",
  frontGeneration: "pb",
  frontIndex,
  frontSongId: frontIndex,
  ...(position === undefined ? {} : { position }),
  rule,
});

const back = (generation: string, songId: number, variantFor: VariantFor) => ({
  generation,
  removed: false,
  songId,
  variantFor,
});

Deno.test("表の直後に裏が番号の順に並び、その後に5鍵盤版が並ぶ", () => {
  const grouped = withFrontsFirst([
    back("3rd", 1, of(5, "custom", 1)),
    front("pb", 5, 5),
    { ...front("djt", 2, 102), variantFor: of(5, "5keys") },
    front("7th", 3, 103),
    back("9th", 4, of(5, "custom", 0)),
    back("8th", 6, of(99, "custom", 0)),
    back("us", 7, of(102, "custom", 0)),
    back("10th", 8, of(5, "custom", 2)),
  ]);
  // 5鍵盤版の裏(us)は、5鍵盤版の直後に並ぶ。表の無い裏(8th)は元の位置に残る
  assertEquals(
    grouped.map(({ generation, songId }) => generation + songId),
    ["pb5", "9th4", "3rd1", "10th8", "djt2", "us7", "7th3", "8th6"],
  );
});

Deno.test("同じ曲番号の表が2つあれば、裏は曲indexで指した表に付く", () => {
  const grouped = withFrontsFirst([
    front("7th", 17, 239),
    front("7th", 17, 400),
    back("8th", 55, of(400, "custom", 0)),
  ]);
  assertEquals(
    grouped.map((row) => "saveIndex" in row ? row.saveIndex : row.songId),
    [239, 400, 55],
  );
});

Deno.test("裏の曲のフォルダーが表の曲と違えば例外にする", () => {
  const backIn = (generation: string, songId: number, folder: string) => ({
    ...back(generation, songId, of(5, "custom", 0)),
    folder,
  });
  const rows = [
    { ...front("pb", 5, 5), folder: "4th" },
    backIn("3rd", 1, "4th"),
    { ...front("6th", 2, 100), folder: "6th" },
  ];
  assertBackFolders(rows);
  assertThrows(
    () => assertBackFolders([...rows, backIn("7th", 3, "6th")]),
    Error,
    "表の曲とフォルダーが違う裏の曲: 7th:3(6th) → pb:5(4th)",
  );
});
