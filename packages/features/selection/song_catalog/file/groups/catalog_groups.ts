// 全曲リストの行を、`index_title`(無ければ`title`)から作るキーと`edition`で組にまとめ、組の表を選ぶ。

import type { CatalogRow } from "../tsv.ts";

/** 世代1つ分の全曲リスト */
export interface GenerationCatalog {
  generation: string;
  rows: readonly CatalogRow[];
}

/** 世代をまたいで同じ曲を見分けるキー。空文字はどの曲とも同じにしない */
export type SongKeyOf = (generation: string, row: CatalogRow) => string;

/** 原作が5鍵盤版として持つ曲の行なら真。この行は表にならず、組の5鍵盤版になる */
export type IsFiveKeyTwin = (generation: string, row: CatalogRow) => boolean;

export interface GroupRow {
  generation: string;
  row: CatalogRow;
}

export interface CatalogGroup {
  /** 選曲リストに並ぶ表 */
  front: GroupRow;
  /** 原作の5鍵盤版 */
  twin?: GroupRow;
  /** 表と原作の5鍵盤版を除いた行。全曲リストのファイルの順に並ぶ */
  others: GroupRow[];
}

export const titleOf = (row: CatalogRow) =>
  row.songId === null ? row.name : `${row.name}:${row.songId}`;

/**
 * 曲の値を全曲リストから引くキー。全曲リストの行番号を持つ曲は、その行で引く。
 * 同じ曲を2行に書いた曲は、行ごとに副題やエディションが違うからである。
 * 行番号を持たない曲(PB原盤の曲)は、曲番号で引く
 */
export const catalogKeyOf = (
  generation: string,
  songId: number,
  line?: number,
): string =>
  line === undefined ? `${generation}:${songId}` : `${generation}@${line}`;

/** 全曲リストのファイルの順。us は、どの作品よりも前にする */
export const orderOf = (
  catalogs: readonly GenerationCatalog[],
  generation: string,
): number =>
  generation === "us"
    ? -1
    : catalogs.findIndex((catalog) => catalog.generation === generation);

const isCandidate = ({ row }: GroupRow) =>
  row.front?.fiveKeys !== true && row.front?.rule === undefined;

const linesOf = (rows: readonly GroupRow[]) =>
  `${rows[0].generation}の全曲リスト line ` +
  rows.map(({ row }) => row.line).join(", ");

/** `front`を書いた行が無ければ、最も後の作品の行を表にする */
function frontOf(
  catalogs: readonly GenerationCatalog[],
  candidates: readonly GroupRow[],
): GroupRow {
  const preferred = candidates.filter(({ row }) => row.front?.preferred);
  if (preferred.length > 1) {
    throw new Error(`${linesOf(preferred)}: 組の表を2行に書いている`);
  }
  if (preferred.length === 1) {
    return preferred[0];
  }
  const latest = Math.max(
    ...candidates.map(({ generation }) => orderOf(catalogs, generation)),
  );
  const fronts = candidates.filter(({ generation }) =>
    orderOf(catalogs, generation) === latest
  );
  if (fronts.length > 1) {
    throw new Error(`${linesOf(fronts)}: 組の表の候補が同じ作品に2行ある`);
  }
  return fronts[0];
}

function groupOf(
  catalogs: readonly GenerationCatalog[],
  rows: readonly GroupRow[],
  isTwin: IsFiveKeyTwin,
): CatalogGroup {
  const twins = rows.filter(({ generation, row }) => isTwin(generation, row));
  if (twins.length > 1) {
    throw new Error(`${linesOf(twins)}: 組に原作の5鍵盤版が2曲ある`);
  }
  const candidates = rows.filter((r) => !twins.includes(r) && isCandidate(r));
  if (candidates.length === 0) {
    throw new Error(`${linesOf(rows)}: 組に表にできる行が無い`);
  }
  const front = frontOf(catalogs, candidates);
  return {
    front,
    ...(twins.length === 0 ? {} : { twin: twins[0] }),
    others: rows.filter((r) => r !== front && !twins.includes(r)),
  };
}

/**
 * 外した行は組に入れない。キーが空の行は、1行で1つの組にする。
 * `edition`を書いた行は、同じ曲の別の版として、同じキーのほかの行と別の組にする
 */
export function catalogGroupsOf(
  catalogs: readonly GenerationCatalog[],
  keyOf: SongKeyOf,
  isTwin: IsFiveKeyTwin,
): CatalogGroup[] {
  const rows = catalogs.flatMap(({ generation, rows }) =>
    rows.filter((row) => !row.exclude).map((row) => ({ generation, row }))
  );
  const byKey = Map.groupBy(rows, (r) => {
    const key = keyOf(r.generation, r.row);
    return key === "" ? r : `${key}\t${r.row.edition ?? ""}`;
  });
  return [...byKey.values()].map((group) => groupOf(catalogs, group, isTwin));
}

/**
 * 組の副題は、組のどれか1行に書けばよい。表を替えても副題を書き直さずに済むためである。
 * 副題は表の行に付け、ほかの行からは消す。裏の曲の副題は、ゲーム内に出ないからである。
 * 5鍵盤版の行は、自分の副題を持つ
 */
export function withGroupSubtitles(
  catalogs: readonly GenerationCatalog[],
  keyOf: SongKeyOf,
  isTwin: IsFiveKeyTwin,
): GenerationCatalog[] {
  const subtitleOf = new Map<CatalogRow, string | null>();
  for (const { front, others } of catalogGroupsOf(catalogs, keyOf, isTwin)) {
    const members = [front, ...others].filter(({ row }) =>
      row.front?.fiveKeys !== true
    );
    const subtitles = [
      ...new Set(members.flatMap(({ row }) => row.subtitle ?? [])),
    ];
    if (subtitles.length > 1) {
      const lines = members.map(({ generation, row }) =>
        `${generation} line ${row.line}`
      );
      throw new Error(
        `${lines.join(", ")}: 組に違う副題が2つある(${subtitles.join(", ")})`,
      );
    }
    members.forEach(({ row }) =>
      subtitleOf.set(row, row === front.row ? subtitles[0] ?? null : null)
    );
  }
  return catalogs.map(({ generation, rows }) => ({
    generation,
    rows: rows.map((row) =>
      subtitleOf.has(row) ? { ...row, subtitle: subtitleOf.get(row)! } : row
    ),
  }));
}
