// 全曲リストの1ファイルを読む。管理名に`"`や`,`が入るので、
// 値はタブだけで分け、`"`は普通の文字として扱う。

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
  "front",
  "front_charts",
  "front_rule",
  "folder",
  ...CHARTS,
  "exclude",
  "note",
];

export const CATALOG_HEADER = COLUMNS.join("\t");

/** 難易度の最初の列の位置(0始まり) */
export const LEVEL_COLUMN_START = COLUMNS.indexOf(CHARTS[0]);

const SONG_ID_SUFFIX = /:(\d+)$/;
const LEVEL = /^\d+$/;
/** 難易度の列にこの値を書いた譜面は、収録しない */
const EXCLUDED_CHART = "x";

export function parseSongCatalog(text: string): CatalogRow[] {
  const lines = text.split("\n");
  if (lines.at(-1) === "") {
    lines.pop();
  }
  if (lines[0] !== CATALOG_HEADER) {
    throw new Error(`line 1: unexpected header: ${lines[0]}`);
  }
  return lines.slice(1).map((text, index) => rowOf(text, index + 2));
}

function rowOf(text: string, line: number): CatalogRow {
  // 行末の空の列は、エディターが末尾のタブを消しても読めるように省いてよい
  const written = text.split("\t");
  if (written.length > COLUMNS.length) {
    throw new Error(
      `line ${line}: ${written.length} columns, expected ${COLUMNS.length}`,
    );
  }
  const values = COLUMNS.map((_, index) => written[index] ?? "");
  const [
    title,
    indexTitle,
    edition,
    genre,
    fullTitle,
    subtitle,
    artist,
    ...rest
  ] = values;
  const frontTexts = rest.slice(0, 3);
  const [folder, ...charted] = rest.slice(3);
  const levelTexts = charted.slice(0, CHARTS.length);
  const [exclude, note] = charted.slice(CHARTS.length);
  const front = frontOf(frontTexts, line);
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
