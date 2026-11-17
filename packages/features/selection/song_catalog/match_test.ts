// 全曲リストと曲DBの照合。ファイルもディスクも読まず、組み立てた行と曲で確かめる。
// 実行: deno test packages/features/selection/song_catalog/match_test.ts

import { type DbSong, matchSongCatalog, songKey } from "./match.ts";
import type { CatalogRow } from "./file/mod.ts";

function assertJson(actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`${a} != ${e}`);
  }
}

function row(line: number, name: string, songId: number | null = null) {
  return {
    line,
    name,
    songId,
    indexTitle: null,
    edition: null,
    genre: null,
    fullTitle: null,
    subtitle: null,
    artist: null,
    folder: null,
    levels: {},
    excludedCharts: [],
    exclude: false,
    note: null,
  } satisfies CatalogRow;
}

function songs(...titles: string[]): DbSong[] {
  return titles.map((title, songId) => ({ songId, title }));
}

/** 報告を種類と行番号か曲番号で並べる */
function summaryOf(rows: CatalogRow[], db: DbSong[]): string[] {
  return matchSongCatalog(rows, db).reports.map((report) =>
    report.kind + ":" + ("row" in report ? report.row.line : report.song.songId)
  );
}

Deno.test("全曲を1行ずつ書けば報告は無い", () => {
  const result = matchSongCatalog([row(2, "A"), row(3, "B")], songs("A", "B"));
  assertJson(result.matches.map((m) => m.song.songId), [0, 1]);
  assertJson(result.reports, []);
});

Deno.test("管理名は前後の空白を除いて比べる", () => {
  assertJson(summaryOf([row(2, "A"), row(3, "", 1)], songs("A ", " ")), []);
});

Deno.test("リストに無い曲を曲DBの順に報告する", () => {
  assertJson(summaryOf([row(2, "B")], songs("A", "B", "C")), [
    "missing:0",
    "missing:2",
  ]);
});

Deno.test("管理名が重複する曲は`:{song_id}`で指す", () => {
  const db = songs("A", "A");
  assertJson(summaryOf([row(2, "A", 1), row(3, "A", 0)], db), []);
  assertJson(summaryOf([row(2, "A")], db), [
    "ambiguous:2",
    "missing:0",
    "missing:1",
  ]);
});

Deno.test("曲DBに無い管理名と番号を報告する", () => {
  assertJson(summaryOf([row(2, "X"), row(3, "A", 5)], songs("A")), [
    "unknown:2",
    "unknown:3",
    "missing:0",
  ]);
});

Deno.test("番号の曲と管理名が違う行を報告する", () => {
  assertJson(summaryOf([row(2, "B", 0)], songs("A", "B")), [
    "nameMismatch:2",
    "missing:0",
    "missing:1",
  ]);
});

Deno.test("同じ曲を指す2行目以降を報告する", () => {
  const db = songs("A", "B");
  assertJson(summaryOf([row(2, "A"), row(3, "B"), row(4, "A", 0)], db), [
    "duplicate:4",
  ]);
});

Deno.test("同じ曲を指す2行目に別のindex_titleかeditionを書けば、重複でなく写しとして結ぶ", () => {
  const copy = { ...row(4, "A"), indexTitle: "P" };
  const same = { ...row(5, "A"), indexTitle: "P" };
  const edition = { ...row(6, "A"), edition: "5th" };
  const result = matchSongCatalog(
    [row(2, "A"), row(3, "B"), copy, same, edition],
    songs("A", "B"),
  );
  assertJson(
    summaryOf([row(2, "A"), row(3, "B"), copy, same], songs("A", "B")),
    [
      "duplicate:5",
    ],
  );
  assertJson(result.matches.map((m) => m.row.line), [2, 3]);
  assertJson(result.copies.map((m) => [m.row.line, m.song.songId]), [
    [4, 0],
    [6, 0],
  ]);
});

Deno.test("管理名が重複する曲のキーだけに`:{song_id}`を付ける", () => {
  const db = songs("A", " A", "B");
  assertJson(
    db.map((song) => songKey(song, db)),
    ["A:0", "A:1", "B"],
  );
});
