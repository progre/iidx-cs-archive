// 全曲リストの行を曲DBの曲へ結ぶ。原盤の管理名には前後に空白を持つものや
// 空白だけのものがあるので、管理名は前後の空白を除いて比べる。

import type { CatalogRow } from "./file/mod.ts";

export interface DbSong {
  songId: number;
  /** 曲DBの管理名 */
  title: string;
}

/** リストの`title`列に書く形。管理名が重複する曲は`:{song_id}`を付ける */
export function songKey(song: DbSong, songs: DbSong[]): string {
  const name = song.title.trim();
  const shared = songs.filter((other) => other.title.trim() === name);
  return shared.length > 1 ? name + ":" + song.songId : name;
}

export interface CatalogMatch {
  row: CatalogRow;
  song: DbSong;
}

export type CatalogReport =
  /** 曲DBにあってリストに無い曲 */
  | { kind: "missing"; song: DbSong }
  /** 管理名か`:{song_id}`の曲が曲DBに無い行 */
  | { kind: "unknown"; row: CatalogRow }
  /** `:{song_id}`の曲の管理名が違う行 */
  | { kind: "nameMismatch"; row: CatalogRow; song: DbSong }
  /** 管理名が重複するのに`:{song_id}`が無い行 */
  | { kind: "ambiguous"; row: CatalogRow; songs: DbSong[] }
  /** 前の行と同じ曲を指す行 */
  | { kind: "duplicate"; row: CatalogRow; song: DbSong };

export interface CatalogMatchResult {
  /**
   * 同じ曲を指す2行目以降のうち、前の行と違う`index_title`か`edition`を書いた行。曲を別の組でも使う写しである。
   * 1行目は`matches`に入る
   */
  copies: CatalogMatch[];
  matches: CatalogMatch[];
  /** 行の報告を行の順に並べ、その後に不足の曲を曲DBの順に並べる */
  reports: CatalogReport[];
}

type Resolution = { match: CatalogMatch } | { report: CatalogReport };

export function matchSongCatalog(
  rows: CatalogRow[],
  songs: DbSong[],
): CatalogMatchResult {
  const resolved = rows.map((row) => resolve(row, songs));
  const candidates = resolved.flatMap((r) => "match" in r ? [r.match] : []);
  const matches = candidates.filter((match, index) =>
    candidates.findIndex((other) => other.song === match.song) === index
  );
  const later = candidates.filter((match) => !matches.includes(match));
  // 写しは別の組に入るので、同じ曲を指す前の行のどれとも違う index_title か edition を持つ
  const copies = later.filter((match) =>
    candidates.slice(0, candidates.indexOf(match)).every((earlier) =>
      earlier.song !== match.song ||
      earlier.row.indexTitle !== match.row.indexTitle ||
      earlier.row.edition !== match.row.edition
    )
  );
  const duplicates = later
    .filter((match) => !copies.includes(match))
    .map((match): CatalogReport => ({ kind: "duplicate", ...match }));
  const rowReports = resolved
    .flatMap((r) => "report" in r ? [r.report] : [])
    .concat(duplicates)
    .sort((a, b) => lineOf(a) - lineOf(b));
  const matched = new Set(matches.map((match) => match.song));
  const missing = songs
    .filter((song) => !matched.has(song))
    .map((song): CatalogReport => ({ kind: "missing", song }));
  return { copies, matches, reports: rowReports.concat(missing) };
}

function resolve(row: CatalogRow, songs: DbSong[]): Resolution {
  const name = row.name.trim();
  if (row.songId != null) {
    const song = songs.find((song) => song.songId === row.songId);
    if (song == null) {
      return { report: { kind: "unknown", row } };
    }
    return song.title.trim() === name
      ? { match: { row, song } }
      : { report: { kind: "nameMismatch", row, song } };
  }
  const named = songs.filter((song) => song.title.trim() === name);
  if (named.length === 0) {
    return { report: { kind: "unknown", row } };
  }
  return named.length === 1
    ? { match: { row, song: named[0] } }
    : { report: { kind: "ambiguous", row, songs: named } };
}

function lineOf(report: CatalogReport): number {
  return "row" in report ? report.row.line : Number.MAX_SAFE_INTEGER;
}
