// 全曲リストの組と世代の行の結び付け。ファイルを読まず、組み立てた行で確かめる。

import { assertEquals, assertThrows } from "@std/assert";
import type { CatalogRow, ManifestSongDraft } from "@csa/core";
import { variantsOf, withOtherGenerationFronts } from "./variants.ts";

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

const fronted = (front: CatalogRow) => {
  const catalogRows = new Map([
    ["5th", new Map([[3, row("E")]])],
    ["7th", new Map([[8, front]])],
  ]);
  const variants = variantsOf("5th", catalogRows.get("5th")!, [variantRow]);
  const back = {
    sourceGeneration: "5th",
    sourceSongIndex: 3,
    variantOf: variants.get(variantRow.line)?.variant,
  } as ManifestSongDraft;
  return withOtherGenerationFronts(
    new Map([["5th", [back]]]),
    catalogRows,
    [variantRow],
  );
};

Deno.test("別の世代の表の曲は、周回の後で表の世代の全曲リストから引く", () => {
  assertEquals(fronted(row("E")).get("5th")?.[0].variantOf, {
    frontLine: 5,
    generation: "7th",
    position: 0,
    rule: "custom",
    songId: 8,
  });
});

Deno.test("別の世代の表の曲を、表の世代の全曲リストで外していると止まる", () => {
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
  const rows = [
    variantRow,
    { ...variantRow, frontGeneration: "8th", line: 3 },
  ];
  const variants = variantsOf("5th", catalogRows.get("5th")!, rows);
  // 2行目の写しの行を、1行目より前に並べる
  const backs = [3, 2].map((line) =>
    ({
      sourceGeneration: "5th",
      sourceSongIndex: 3,
      variantOf: variants.get(line)?.variant,
    }) as ManifestSongDraft
  );
  const result = withOtherGenerationFronts(
    new Map([["5th", backs]]),
    catalogRows,
    rows,
  ).get("5th")!;
  assertEquals(
    result.map(({ variantOf }) => [variantOf?.generation, variantOf?.songId]),
    [["8th", 9], ["7th", 8]],
  );
});
