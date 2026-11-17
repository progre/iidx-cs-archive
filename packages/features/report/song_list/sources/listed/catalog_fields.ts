// 全曲リストの行から、曲リストに出す曲ごとの値を引く表を作る。表は`catalogKeyOf`のキーで引く。
// 収録する曲と外した曲は、自分の行番号で引く。同じ曲を2行に書いた曲は、行ごとに値が違うからである。
// PB原盤の曲は行番号を持たないので、曲番号で引く。

import type { CatalogRow } from "@csa/core";
import type { RowPorts } from "../../ports.ts";

type KeyOf = RowPorts["catalogKeyOf"];

/** 世代 → 曲番号 → 全曲リストの行(曲の1行目) */
type CatalogRows = ReadonlyMap<string, ReadonlyMap<number, CatalogRow>>;

/** 組の副題を表の行に寄せた、全世代の全曲リスト */
export type GroupedCatalogs = readonly {
  generation: string;
  rows: readonly CatalogRow[];
}[];

/** キー → 行。副題は、組の表の行に寄せた後の値である */
const keyedRowsOf = (
  catalogKeyOf: KeyOf,
  catalogRows: CatalogRows,
  catalogs: GroupedCatalogs,
): [string, CatalogRow][] => [
  ...catalogs.flatMap(({ generation, rows }) =>
    rows.map((row): [string, CatalogRow] => [
      catalogKeyOf(generation, 0, row.line),
      row,
    ])
  ),
  ...[...catalogRows].flatMap(([generation, rows]) =>
    [...rows].map(([songId, row]): [string, CatalogRow] => [
      catalogKeyOf(generation, songId),
      row,
    ])
  ),
];

const valuesOf = <T>(
  catalogKeyOf: KeyOf,
  catalogRows: CatalogRows,
  catalogs: GroupedCatalogs,
  valueOf: (row: CatalogRow) => T | null | undefined,
): Map<string, T> =>
  new Map(
    keyedRowsOf(catalogKeyOf, catalogRows, catalogs).flatMap(([key, row]) => {
      const value = valueOf(row);
      return value === null || value === undefined ? [] : [[key, value]];
    }),
  );

/** キー → 全曲リストの`subtitle`。副題の無い曲は持たない。裏の曲の行は、副題を表の行へ寄せたので持たない */
export const subtitlesOf = (
  catalogKeyOf: KeyOf,
  catalogRows: CatalogRows,
  catalogs: GroupedCatalogs,
): Map<string, string> =>
  valuesOf(catalogKeyOf, catalogRows, catalogs, (row) => row.subtitle);

/** キー → 全曲リストの`edition`。組は`edition`ごとに分かれるので、裏の曲の行も表の曲と同じ値を持つ */
export const editionsOf = (
  catalogKeyOf: KeyOf,
  catalogRows: CatalogRows,
  catalogs: GroupedCatalogs,
): Map<string, string> =>
  valuesOf(catalogKeyOf, catalogRows, catalogs, (row) => row.edition);
