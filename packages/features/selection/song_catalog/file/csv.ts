// 全曲リストの1ファイルを読む。`,`や`"`を含む値は、`"`で囲んで書く。

import { parse } from "@std/csv";
import type { CatalogRow } from "@csa/core";
export type { CatalogRow };
import { type Chart, CHARTS } from "./charts.ts";
import { frontOf } from "./front.ts";

export { type Chart, CHARTS } from "./charts.ts";
export type { CatalogFront, CatalogRule } from "./front.ts";

const COLUMNS = [
  "title",
  "index_title",
  "edition",
  "genre",
  "full_title",
  "subtitle",
  "artist",
  "folder",
  "common_movie",
  "save_slot_owner",
  "front_rule",
  // 難易度の列と結びつくので、難易度の列の直前に置く
  "chart_moves",
  ...CHARTS,
  "exclude",
  "note",
];

export const CATALOG_HEADER = COLUMNS.join(",");

/** 難易度の最初の列の位置(0始まり) */
export const LEVEL_COLUMN_START = COLUMNS.indexOf(CHARTS[0]);

const SONG_ID_SUFFIX = /:(\d+)$/;
const LEVEL = /^\d+$/;
/** 難易度の列にこの値を書いた譜面は、収録しない */
const EXCLUDED_CHART = "x";

export function parseSongCatalog(text: string): CatalogRow[] {
  const [header, ...rows] = parse(text);
  if (header?.join(",") !== CATALOG_HEADER) {
    throw new Error(`line 1: unexpected header: ${header?.join(",")}`);
  }
  // 値に改行を書かないので、表の行の番号はファイルの行の番号と同じになる
  return rows.map((cells, index) => rowOf(cells, index + 2));
}

function rowOf(written: string[], line: number): CatalogRow {
  // 列の数が違う行があると、GitHub が表として表示しないので、行末の空の列も省かない
  if (written.length !== COLUMNS.length) {
    throw new Error(
      `line ${line}: ${written.length} columns, expected ${COLUMNS.length}`,
    );
  }
  const [
    title,
    indexTitle,
    edition,
    genre,
    fullTitle,
    subtitle,
    artist,
    folder,
    commonMovie,
    frontText,
    frontRule,
    chartMovesText,
    ...charted
  ] = written;
  const levelTexts = charted.slice(0, CHARTS.length);
  const [exclude, note] = charted.slice(CHARTS.length);
  const front = frontOf([frontText, chartMovesText, frontRule], line);
  const suffix = SONG_ID_SUFFIX.exec(title);
  return {
    line,
    name: suffix == null ? title : title.slice(0, suffix.index),
    songId: suffix == null ? null : Number(suffix[1]),
    indexTitle: indexTitle || null,
    edition: edition || null,
    genre: genre || null,
    fullTitle: fullTitle || null,
    subtitle: subtitle || null,
    artist: artist || null,
    folder: folder || null,
    levels: levelsOf(levelTexts, line),
    excludedCharts: CHARTS.filter((_, index) =>
      levelTexts[index] === EXCLUDED_CHART
    ),
    exclude: exclude !== "",
    note: note || null,
    ...(commonMovie === "" ? {} : { commonMovie }),
    ...(front === undefined ? {} : { front }),
  };
}

function levelsOf(
  texts: string[],
  line: number,
): Partial<Record<Chart, number>> {
  const entries = CHARTS.flatMap((chart, index) => {
    const text = texts[index];
    if (text === "" || text === EXCLUDED_CHART) {
      return [];
    }
    if (!LEVEL.test(text)) {
      throw new Error(
        `line ${line}: ${chart} is not a number or ${EXCLUDED_CHART}: ${text}`,
      );
    }
    return [[chart, Number(text)] as const];
  });
  return Object.fromEntries(entries);
}
