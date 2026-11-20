// 全曲リストの行を、`index_title`(無ければ`title`)から作るキーと`edition`で組にまとめ、
// 組のセーブの枠の持ち主と表を選ぶ。

import type { CatalogRow } from "../csv.ts";

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

/**
 * 組の候補の行から、表(選曲リストに並ぶ行)を選ぶ。`owner`は組のセーブの枠の持ち主で、候補に含まれる。
 * 原作の5鍵盤版の組には使わない
 */
export type FrontChooser = (
  candidates: readonly GroupRow[],
  owner: GroupRow,
) => GroupRow;

/** 枠の持ち主を表にする。表の曲を選ぶ材料がそろう前に使う */
export const ownerAsFront: FrontChooser = (_, owner) => owner;

export interface CatalogGroup {
  /** 選曲リストに並ぶ表 */
  front: GroupRow;
  /** 組のセーブの枠の持ち主。表と同じ行のこともある */
  owner: GroupRow;
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

/**
 * 組のセーブの枠の持ち主。組に PB の行があれば、PB の行である。
 * 無ければ`save_slot_owner`を書いた行で、それも無ければ最も後の作品の行である
 */
function ownerOf(
  catalogs: readonly GenerationCatalog[],
  candidates: readonly GroupRow[],
): GroupRow {
  const owners = candidates.filter(({ row }) => row.front?.slotOwner);
  if (owners.length > 1) {
    throw new Error(`${linesOf(owners)}: 組の枠の持ち主を2行に書いている`);
  }
  const pb = candidates.find(({ generation }) => generation === "pb");
  if (pb !== undefined && owners.length === 1) {
    throw new Error(
      `${linesOf(owners)}: 組に PB の行があるので、枠の持ち主を書けない`,
    );
  }
  if (owners.length === 1) {
    return owners[0];
  }
  const latest = Math.max(
    ...candidates.map(({ generation }) => orderOf(catalogs, generation)),
  );
  const latestRows = candidates.filter(({ generation }) =>
    orderOf(catalogs, generation) === latest
  );
  if (latestRows.length > 1) {
    throw new Error(
      `${linesOf(latestRows)}: 組の枠の持ち主の候補が同じ作品に2行ある`,
    );
  }
  return latestRows[0];
}

function groupOf(
  catalogs: readonly GenerationCatalog[],
  rows: readonly GroupRow[],
  isTwin: IsFiveKeyTwin,
  chooseFront: FrontChooser,
): CatalogGroup {
  const twins = rows.filter(({ generation, row }) => isTwin(generation, row));
  if (twins.length > 1) {
    throw new Error(`${linesOf(twins)}: 組に原作の5鍵盤版が2曲ある`);
  }
  const candidates = rows.filter((r) => !twins.includes(r) && isCandidate(r));
  if (candidates.length === 0) {
    throw new Error(`${linesOf(rows)}: 組に表にできる行が無い`);
  }
  const owner = ownerOf(catalogs, candidates);
  const front = chooseFront(candidates, owner);
  return {
    front,
    owner,
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
  chooseFront: FrontChooser = ownerAsFront,
): CatalogGroup[] {
  const rows = catalogs.flatMap(({ generation, rows }) =>
    rows.filter((row) => !row.exclude).map((row) => ({ generation, row }))
  );
  const byKey = Map.groupBy(rows, (r) => {
    const key = keyOf(r.generation, r.row);
    return key === "" ? r : `${key}\t${r.row.edition ?? ""}`;
  });
  return [...byKey.values()].map((group) =>
    groupOf(catalogs, group, isTwin, chooseFront)
  );
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
  chooseFront: FrontChooser = ownerAsFront,
): GenerationCatalog[] {
  const subtitleOf = new Map<CatalogRow, string | null>();
  const groups = catalogGroupsOf(catalogs, keyOf, isTwin, chooseFront);
  for (const { front, others } of groups) {
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
