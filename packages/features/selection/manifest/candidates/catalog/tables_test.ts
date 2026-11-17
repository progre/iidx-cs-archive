// 共有の表と全曲リストの行の結び付け。ファイルを読まず、組み立てた行で確かめる。

import { assertEquals, assertThrows } from "@std/assert";
import type { CatalogRow } from "@csa/core";
import { sharesOf } from "./tables.ts";

const row = (name: string, songId: number | null = null) =>
  ({ name, songId }) as CatalogRow;

const shared = (title: string, generation = "djt") => ({
  generation,
  line: 2,
  share: "PB_" + title,
  title,
});

Deno.test("全曲リストのtitle列と同じ書き方で、曲番号を引く", () => {
  const rows = new Map([[1, row("A")], [7, row("B", 7)]]);
  assertEquals(
    [...sharesOf("djt", rows, [
      shared("A"),
      shared("B:7"),
      shared("A", "9th"),
    ])],
    [[1, "PB_A"], [7, "PB_B:7"]],
  );
});

Deno.test("全曲リストに無い曲を書くと、行番号を添えて止まる", () => {
  assertThrows(
    () => sharesOf("djt", new Map([[1, row("A")]]), [shared("X")]),
    Error,
    "shared_assets.csv line 2: djtの全曲リストにXが無い",
  );
});
