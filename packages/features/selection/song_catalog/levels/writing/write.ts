// 全曲リストのTSVの文字列へ、難易度を書き込む。書く譜面の列だけを変え、
// ほかの列と行の列数は変えない。行末で省いた列は、書く分だけ空で補う。
// 値がnullの譜面は、列を空にする。

import { type Chart, CHARTS, LEVEL_COLUMN_START } from "../../file/mod.ts";

/** 譜面ごとに書く難易度。nullは、その譜面の難易度を消す */
export type LevelWrites = Partial<Record<Chart, number | null>>;

const SONG_ID_SUFFIX = /:(\d+)$/;

/** 行の`title`列を、`songKey`と同じ形のキーにする */
function keyOf(title: string): string {
  const suffix = SONG_ID_SUFFIX.exec(title);
  return suffix == null
    ? title.trim()
    : title.slice(0, suffix.index).trim() + ":" + suffix[1];
}

/** 全曲リストの行のキー。列名の行は含まない */
export function catalogKeys(text: string): Set<string> {
  return new Set(
    text.split("\n").slice(1).filter((line) => line !== "")
      .map((line) => keyOf(line.split("\t")[0])),
  );
}

function withLevels(
  line: string,
  levels: LevelWrites,
): { line: string; changed: number } {
  const cells = line.split("\t");
  const changed = Object.entries(levels).filter(([chart, level]) => {
    const column = LEVEL_COLUMN_START + CHARTS.indexOf(chart as Chart);
    while (cells.length <= column) {
      cells.push("");
    }
    const before = cells.at(column);
    const after = level == null ? "" : String(level);
    cells.splice(column, 1, after);
    return before !== after;
  }).length;
  return { line: cells.join("\t"), changed };
}

/**
 * 列名の行は変えない。`levels`はキーから譜面ごとの難易度を引く。
 * `missing`は、リストに行が無かったキーである
 */
export function applyLevels(
  text: string,
  levels: Map<string, LevelWrites>,
): { text: string; changed: number; missing: string[] } {
  let changed = 0;
  const written = new Set<string>();
  const lines = text.split("\n").map((line, index) => {
    const key = keyOf(line.split("\t")[0]);
    const found = index === 0 ? undefined : levels.get(key);
    if (found == null) {
      return line;
    }
    const result = withLevels(line, found);
    changed += result.changed;
    written.add(key);
    return result.line;
  });
  return {
    text: lines.join("\n"),
    changed,
    missing: Array.from(levels.keys()).filter((key) => !written.has(key)),
  };
}
