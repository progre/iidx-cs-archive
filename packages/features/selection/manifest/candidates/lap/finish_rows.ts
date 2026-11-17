// 周回で作った曲の行を、周回の後に仕上げる処理と、周回の中で下書きを埋める処理。

import type { CatalogRow, ManifestSongDraft } from "@csa/core";
import { manifestOrderOfGeneration, rowKey } from "../../build/rows/mod.ts";
import {
  withOtherGenerationFiveKeys,
  withOtherGenerationFronts,
  withPbSlotFronts,
} from "../catalog/mod.ts";

/** 全世代の周回を終えた後に、世代をまたぐ裏の曲と5鍵盤の曲を行へ足す */
export function withOtherGenerationRows(
  rowsOf: ReadonlyMap<string, readonly ManifestSongDraft[]>,
  catalogRows: ReadonlyMap<string, ReadonlyMap<number, CatalogRow>>,
  variants: Parameters<typeof withPbSlotFronts>[2],
  fiveKeys: Parameters<typeof withOtherGenerationFiveKeys>[2],
) {
  const pbSlotted = withPbSlotFronts(
    withOtherGenerationFronts(rowsOf, catalogRows, variants),
    catalogRows,
    variants,
  );
  return {
    pbBacks: pbSlotted.pbBacks,
    rowsOf: withOtherGenerationFiveKeys(
      pbSlotted.rowsOf,
      catalogRows,
      fiveKeys,
    ),
  };
}

/**
 * 世代の行の下書きを埋める。
 * 全曲リストで外した行は、素材を書かず、曲リストに出す下書きだけを作る。
 * `ordered`は素材を書く行で、manifestに載るのと同じ順に並ぶ。
 * `rows`は入力と同じ順の行で、`all`は下書きを埋めた行である
 */
export function draftedLapRows<D extends ManifestSongDraft>(
  rows: readonly ManifestSongDraft[],
  isPlayable: (row: ManifestSongDraft) => boolean,
  draftOf: (row: ManifestSongDraft) => D,
): { all: D[]; ordered: D[]; rows: ManifestSongDraft[] } {
  const ordered = manifestOrderOfGeneration(rows, isPlayable).map(draftOf);
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
