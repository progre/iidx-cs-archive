// 全曲リストの組と世代の行の結び付け。ファイルを読まず、組み立てた行で確かめる。

import { assertEquals, assertThrows } from "@std/assert";
import type { CatalogRow, ManifestSongDraft } from "@csa/core";
import { withCatalogVariants } from "./variants.ts";

const row = (name: string) => ({ name, songId: null }) as CatalogRow;

const variantRow = {
  frontGeneration: "7th",
  frontLine: 5,
  frontTitle: "E",
  generation: "5th",
  line: 2,
  position: 0,
  title: "E",
};

const lapRow = (line: number, extra: Partial<ManifestSongDraft> = {}) =>
  ({
    catalogLine: line,
    sourceGeneration: "5th",
    sourceSongIndex: 3,
    ...extra,
  }) as ManifestSongDraft;

const fronted = (front: CatalogRow, back = lapRow(2)) =>
  withCatalogVariants(
    new Map([["5th", [back]]]),
    new Map([
      ["5th", new Map([[3, row("E")]])],
      ["7th", new Map([[8, front]])],
    ]),
    [variantRow],
  ).get("5th")?.[0];

Deno.test("裏の曲の行に、別の世代の表の曲を全曲リストから引いて書く", () => {
  assertEquals(fronted(row("E"))?.variantOf, {
    frontLine: 5,
    generation: "7th",
    position: 0,
    rule: "custom",
    songId: 8,
  });
});

Deno.test("裏になった行は、表の曲の中で譜面を移さない", () => {
  const back = lapRow(2, { chartMoves: { sp_black: "sp_another" } });
  assertEquals(fronted(row("E"), back)?.chartMoves, undefined);
});

Deno.test("枠の持ち主が裏になると、原作の5鍵盤版を表の曲に結ぶ", () => {
  const twin = lapRow(4, { fiveKeyOf: { songId: 3 }, sourceSongIndex: 9 });
  const front = { ...lapRow(5), sourceGeneration: "7th", sourceSongIndex: 8 };
  const result = withCatalogVariants(
    new Map([["5th", [lapRow(2), twin]], ["7th", [front]]]),
    new Map([
      ["5th", new Map([[3, row("E")]])],
      ["7th", new Map([[8, row("E")]])],
    ]),
    [{ ...variantRow, slotOwner: true }],
  );
  assertEquals(result.get("5th")?.[1].fiveKeyOf, {
    generation: "7th",
    songId: 8,
  });
});

Deno.test("表の曲を、表の世代の全曲リストで外していると止まる", () => {
  assertThrows(
    () => fronted({ ...row("E"), exclude: true }),
    Error,
    "5thの全曲リスト line 2: 7thの全曲リストでEを外している",
  );
});

Deno.test("同じ曲を2行に書いて別々の世代を表にすると、行ごとに表の曲を引く", () => {
  const catalogRows = new Map([
    ["5th", new Map([[3, row("E")]])],
    ["7th", new Map([[8, row("E")]])],
    ["8th", new Map([[9, row("E")]])],
  ]);
  const variants = [
    variantRow,
    { ...variantRow, frontGeneration: "8th", line: 3 },
  ];
  const result = withCatalogVariants(
    new Map([["5th", [lapRow(3), lapRow(2)]]]),
    catalogRows,
    variants,
  ).get("5th")!;
  assertEquals(
    result.map(({ variantOf }) => [variantOf?.generation, variantOf?.songId]),
    [["8th", 9], ["7th", 8]],
  );
});
