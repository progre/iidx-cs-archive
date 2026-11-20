// 周回で作った曲の行を、周回の後に仕上げる処理と、周回の中で下書きを埋める処理。

import type { CatalogRow, ManifestSongDraft } from "@csa/core";
import { manifestOrderOfGeneration, rowKey } from "../../build/rows/mod.ts";
import {
  withCatalogFiveKeys,
  withCatalogVariants,
  withPbSlotFronts,
} from "../catalog/mod.ts";
import {
  assertChartExclusions,
  assertPairsIncluded,
  assertShares,
} from "../rows/mod.ts";

/**
 * 全世代の周回を終えた後に、全曲リストで書いた組を行へ結ぶ。
 * 組の相手がそろったことと、組に入る曲の指定に矛盾が無いことも調べる
 */
export function withOtherGenerationRows(
  rowsOf: ReadonlyMap<string, readonly ManifestSongDraft[]>,
  catalogRows: ReadonlyMap<string, ReadonlyMap<number, CatalogRow>>,
  variants: Parameters<typeof withPbSlotFronts>[2],
  fiveKeys: Parameters<typeof withCatalogFiveKeys>[2],
) {
  const pbSlotted = withPbSlotFronts(
    withCatalogVariants(rowsOf, catalogRows, variants),
    catalogRows,
    variants,
  );
  const result = withCatalogFiveKeys(pbSlotted.rowsOf, catalogRows, fiveKeys);
  for (const rows of result.values()) {
    assertPairsIncluded(rows);
    assertChartExclusions(rows);
    assertShares(rows);
  }
  return { pbBacks: pbSlotted.pbBacks, rowsOf: result };
}

/**
 * 世代の行の下書きを埋める。
 * 全曲リストで外した行は、素材を書かず、曲リストに出す下書きだけを作る。
 * `ordered`は素材を書く行で、manifestに載るのと同じ順に並ぶ。
 * `rows`は入力と同じ順の行で、`all`は下書きを埋めた行である
 */
export function draftedLapRows<D extends ManifestSongDraft>(
  rows: readonly ManifestSongDraft[],
  draftOf: (row: ManifestSongDraft) => D,
): { all: D[]; ordered: D[]; rows: ManifestSongDraft[] } {
  const ordered = manifestOrderOfGeneration(rows).map(draftOf);
  const draftedOf = new Map([
    ...ordered,
    ...rows.filter((row) => row.excluded !== undefined).map(draftOf),
  ].map((song) => [rowKey(song), song]));
  return {
    all: [...draftedOf.values()],
    ordered,
    rows: rows.map((row) => draftedOf.get(rowKey(row)) ?? row),
  };
}
