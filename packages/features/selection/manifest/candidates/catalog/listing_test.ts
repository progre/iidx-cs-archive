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

Deno.test("裏の組は、全曲リストの行が書いた条件のまま使う", () => {
  const variant = { generation: "pb", rule: "alternate", songId: 7 } as const;
  assertEquals(
    listingOf(ports, "dd", 96, listed, undefined, variant)?.variant,
    variant,
  );
  assertEquals(listingOf(ports, "dd", 96, listed)?.variant, null);
});

Deno.test("原作の5鍵盤版の組は、原盤の定義から足す", () => {
  assertEquals(listingOf(ports, "dd", 97, listed)?.fiveKeyOf, { songId: 79 });
});
