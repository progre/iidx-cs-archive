// 全曲リストを曲DBと照合した結果を、報告の行と書き換えにまとめる。
// ファイルと原盤の読み書きは app が担う。

import {
  applyLevels,
  auditLevels,
  type LevelReport,
  type SongOriginal,
} from "./levels/writing/mod.ts";
import {
  type CatalogReport,
  type DbSong,
  matchSongCatalog,
  songKey,
} from "./match.ts";
import { type CatalogRow, parseSongCatalog } from "./file/mod.ts";

const FILE_NAME = /^\d{2}_(.+)\.tsv$/;

const KIND_LABELS: Record<CatalogReport["kind"], string> = {
  missing: "missing",
  unknown: "unknown",
  nameMismatch: "mismatch",
  ambiguous: "ambiguous",
  duplicate: "duplicate",
};

export interface DbContent {
  songs: DbSong[];
  /** 曲DBのindexから、原作の難易度と譜面がある難易度を引く */
  originals: Map<number, SongOriginal>;
}

/** 全曲リストのファイル名から世代を返す。リストのファイル名でなければundefinedを返す */
export function generationOfCatalogFile(name: string): string | undefined {
  return FILE_NAME.exec(name)?.[1];
}

/** 世代からリストのパスを引く表。`directory`は末尾の`/`を含み、`names`はそのフォルダーのファイル名 */
export function catalogPathsOf(
  directory: string,
  names: readonly string[],
): Map<string, string> {
  return new Map(
    names.flatMap((name) => {
      const generation = generationOfCatalogFile(name);
      return generation == null ? [] : [[generation, directory + name]];
    }),
  );
}

/** 世代が定義に無いリストのファイルを報告する行 */
export function strayFileLines(
  paths: ReadonlyMap<string, string>,
  generations: readonly string[],
): string[] {
  return [...paths]
    .filter(([generation]) => !generations.includes(generation))
    .map(([, path]) => `${path}: unknown generation`);
}

export function missingFileLine(generation: string): string {
  return `${generation}: no catalog file`;
}

function rowKey(row: CatalogRow): string {
  return row.songId == null ? row.name : row.name + ":" + row.songId;
}

function keyOf(report: CatalogReport, songs: DbSong[]): string {
  return report.kind === "missing"
    ? songKey(report.song, songs)
    : rowKey(report.row);
}

/** `sameLevel`と`noChart`の報告を、種類ごとの行にする。譜面は括弧に並べる */
function levelLines(generation: string, reports: LevelReport[]): string[] {
  const groups = Map.groupBy(reports, (report) => report.kind);
  return Array.from(groups, ([kind, found]) => {
    const details = found.map((report) =>
      `${rowKey(report.row)}(${report.charts.join(",")})`
    );
    return `${generation} ${kind}: ${details.join(" ")}`;
  });
}

export interface CatalogReview {
  /** 報告の行。問題が無ければ空である */
  lines: string[];
  levelReports: LevelReport[];
}

/** 1世代のリストを、曲DBと照合する */
export function reviewCatalog(
  generation: string,
  catalogText: string,
  content: DbContent,
): CatalogReview {
  const { songs, originals } = content;
  const { matches, reports } = matchSongCatalog(
    parseSongCatalog(catalogText),
    songs,
  );
  const levelReports = auditLevels(matches, originals);
  const kinds = [...new Set(reports.map((report) => report.kind))];
  const catalogLines = kinds.map((kind) => {
    const keys = reports
      .filter((report) => report.kind === kind)
      .map((report) => keyOf(report, songs));
    return `${generation} ${KIND_LABELS[kind]}: ${keys.join(" ")}`;
  });
  return {
    lines: catalogLines.concat(levelLines(generation, levelReports)),
    levelReports,
  };
}

/** 原作と同じ難易度を、リストの文字列から消す */
export function removeSameLevels(
  catalogText: string,
  reports: LevelReport[],
): string {
  const removals = new Map(
    reports.flatMap((report) => {
      if (report.kind !== "sameLevel") {
        return [];
      }
      const { name, songId } = report.row;
      const key = songId == null ? name.trim() : `${name.trim()}:${songId}`;
      return [[key, Object.fromEntries(report.charts.map((c) => [c, null]))]];
    }),
  );
  return applyLevels(catalogText, removals).text;
}
