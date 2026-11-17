// `data/`の表に書いた曲を、全曲リストの行の曲番号に結ぶ。
// 表に誤りがあればビルドを止める。

import type { AnotherSwitchRow, CatalogRow, SharedAssetRow } from "@csa/core";
import type { AnotherSwitches } from "../assets/mod.ts";

/** 全曲リストの`title`列の書き方。管理名が重なる曲は`:{song_id}`を付ける */
export const titleOf = (row: CatalogRow) =>
  row.songId === null ? row.name : `${row.name}:${row.songId}`;

/** `data/`の表の1行。曲は世代と全曲リストの管理名で指す */
interface CatalogSongRow {
  generation: string;
  line: number;
  title: string;
}

/**
 * `data/`の表から、世代の曲番号 → 行の値、を引く表を作る。
 * 表に書いた曲が全曲リストに無ければ止める
 */
function bySongId<R extends CatalogSongRow, V>(
  generation: string,
  rows: ReadonlyMap<number, CatalogRow>,
  table: { fileName: string; rows: readonly R[] },
  valueOf: (row: R) => V,
): Map<number, V> {
  const songIdOf = new Map(
    [...rows].map(([songId, row]) => [titleOf(row), songId]),
  );
  return new Map(
    table.rows.filter((row) => row.generation === generation).map((row) => {
      const songId = songIdOf.get(row.title);
      if (songId === undefined) {
        throw new Error(
          `${table.fileName} line ${row.line}: ${generation}の全曲リストに${row.title}が無い`,
        );
      }
      return [songId, valueOf(row)];
    }),
  );
}

/** 共有の表から、世代の曲番号 → 共有するPB原盤の曲の管理名、を引く表を作る */
export const sharesOf = (
  generation: string,
  rows: ReadonlyMap<number, CatalogRow>,
  shared: readonly SharedAssetRow[],
): Map<number, string> =>
  bySongId(
    generation,
    rows,
    { fileName: "shared_assets.csv", rows: shared },
    (row) => row.share,
  );

/** ANOTHERで使い分ける素材の表から、世代の曲番号 → 素材の指定、を引く表を作る */
export const anotherSwitchesOf = (
  generation: string,
  rows: ReadonlyMap<number, CatalogRow>,
  table: readonly AnotherSwitchRow[],
): Map<number, AnotherSwitches> =>
  bySongId(
    generation,
    rows,
    { fileName: "another_switches.csv", rows: table },
    ({ overlayOnlyAnother, titleCardSprite, video }) => ({
      overlayOnlyAnother,
      titleCardSprite,
      video,
    }),
  );

/** PBの曲は原盤のまま載るので、全曲リストで外せない */
export function assertNoPbExclusion(
  rows: ReadonlyMap<number, CatalogRow>,
): void {
  const excluded = [...rows.values()].filter((row) => row.exclude);
  if (excluded.length > 0) {
    throw new Error(
      `PBの全曲リストにexcludeを書いた行がある: ${
        excluded.map((row) => `line ${row.line}`).join(", ")
      }`,
    );
  }
}
