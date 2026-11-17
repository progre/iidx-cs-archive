// 世代の行を作るときに使う、曲ごとの収録の指定を集める。
// 指定は、全曲リストの行と共有の表に書いてある。

import type { CatalogRow, Chart, FiveKeyFront, SongVariant } from "@csa/core";
import type { AnotherSwitches } from "../assets/mod.ts";
import type { Listing } from "../rows/mod.ts";
import type { ListingPorts } from "./ports.ts";

/** 原作の5鍵盤版の組。表の曲は同じ世代にある */
const originalFiveKeyOf = (
  ports: ListingPorts,
  generation: string,
  songId: number,
): FiveKeyFront | undefined => {
  const front = ports.fiveKeyOf(generation, songId);
  return front === undefined ? undefined : { songId: front };
};

/**
 * `front_charts`を表の曲の行に書くと、その曲の中で譜面を別の難易度へ移す。
 * 裏の行や5鍵盤版の行の`front_charts`は、ここでは扱わない。`variantsOf`が裏の条件に入れる
 */
function movedChartsOf(
  ports: ListingPorts,
  row: CatalogRow,
  variant: SongVariant | undefined,
): Record<string, string> | null {
  const charts = row.front?.charts;
  if (charts === undefined || variant !== undefined || row.front?.fiveKeys) {
    return null;
  }
  return Object.fromEntries(
    Object.entries(charts).map(([to, from]) =>
      ports.difficultyNamesOf([to as Chart, from as Chart])
    ),
  );
}

/**
 * `share`は、PB原盤の曲の管理名である。その曲は、PB原盤のこの曲の音とオーバーレイを使う。
 * 管理名は`shared_assets.csv`から引く。
 * `variant`は、その曲を裏にする条件である。全曲リストの行に書いてある。
 * 5鍵盤版の組は、原盤の定義(`fiveKeyOf`)から引いて加える。
 * 全曲リストに書いた組は`fiveKey`である
 */
export function listingOf(
  ports: ListingPorts,
  generation: string,
  songId: number,
  row: CatalogRow | undefined,
  share?: string,
  variant?: SongVariant,
  another?: AnotherSwitches,
  fiveKey?: FiveKeyFront,
): Listing | undefined {
  if (row === undefined) {
    return undefined;
  }
  return {
    another: another ?? null,
    excluded: row.exclude,
    excludedCharts: ports.difficultyNamesOf(row.excludedCharts),
    fiveKeyOf: originalFiveKeyOf(ports, generation, songId) ?? fiveKey ?? null,
    levels: row.levels,
    line: row.line,
    movedCharts: movedChartsOf(ports, row, variant),
    note: row.note,
    share: share ?? null,
    variant: variant ?? null,
  };
}

/**
 * 曲番号 → その曲の行の指定。同じ曲を全曲リストに2行書いたときは、行ごとに指定を返す。
 * 裏の組は全曲リストの行番号で引く
 */
export const listingsOf = (
  ports: ListingPorts,
  generation: string,
  rowsOf: (songId: number) => readonly (CatalogRow | undefined)[],
  shares: ReadonlyMap<number, string>,
  variantOfLine: (line: number) => SongVariant | undefined,
  anothers: ReadonlyMap<number, AnotherSwitches> = new Map(),
  fiveKeys: ReadonlyMap<number, FiveKeyFront> = new Map(),
) =>
(songId: number): Listing[] =>
  rowsOf(songId).flatMap((row) => {
    const listing = listingOf(
      ports,
      generation,
      songId,
      row,
      shares.get(songId),
      row === undefined ? undefined : variantOfLine(row.line),
      anothers.get(songId),
      row?.front?.fiveKeys ? fiveKeys.get(songId) : undefined,
    );
    return listing === undefined ? [] : [listing];
  });
