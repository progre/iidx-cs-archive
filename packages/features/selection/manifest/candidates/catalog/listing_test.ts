// 全曲リストの行から作る収録の指定。原盤の定義の代わりに、偽の ports で確かめる。

import { assertEquals } from "@std/assert";
import type { CatalogRow } from "@csa/core";
import { listingOf } from "./listing.ts";
import type { ListingPorts } from "./ports.ts";

const ports: ListingPorts = {
  difficultyNamesOf: (charts) => [...charts],
  fiveKeyOf: (generation, songId) =>
    generation === "dd" && songId === 97 ? 79 : undefined,
};

const listed = {
  exclude: false,
  excludedCharts: [],
  note: null,
} as unknown as CatalogRow;

Deno.test("chart_movesは、表か裏かを決める前は表の曲の中で移す譜面として読む", () => {
  const charted = {
    ...listed,
    front: { chartMoves: { sl: "sa" } },
  } as CatalogRow;
  assertEquals(listingOf(ports, "dd", 96, charted)?.chartMoves, { sl: "sa" });
});

Deno.test("原作の5鍵盤版の組は、原盤の定義から足す", () => {
  assertEquals(listingOf(ports, "dd", 97, listed)?.fiveKeyOf, { songId: 79 });
});
