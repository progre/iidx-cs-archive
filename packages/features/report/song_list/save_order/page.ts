// セーブデータの曲の並びのタブ。セーブデータは、曲の記録を曲indexの順に持つ。
// セーブデータに記録の枠を持たない曲(外した曲と裏エントリー)も、原作のsong_idの並びの位置に添える。

import type { SongRow } from "../types.ts";

/** 選曲リストに並ぶ曲、外した曲、裏エントリー。外した曲と裏エントリーは記録の枠を持たない */
export type SaveOrderKind = "listed" | "removed" | "variant";

export interface SaveOrderRow {
  /** 行に付ける class。曲・譜面のタブと同じく、外した曲は黒、裏エントリーは灰色にする */
  classes: string;
  generation: string;
  /** 選曲リストに並ぶ曲だけが持つ */
  index?: number;
  /** index の欄の文字。記録の枠を持たない曲は「—」 */
  indexText: string;
  kind: SaveOrderKind;
  songId: number;
  title: string;
}

interface Placed {
  /** 並べる位置。記録の枠を持たない曲は、枠を持つ曲の間の半端な値になる */
  position: number;
  row: SaveOrderRow;
}

const kindOf = (song: SongRow): SaveOrderKind =>
  song.saveIndex !== undefined
    ? "listed"
    : song.removed
    ? "removed"
    : "variant";

const CLASSES: Record<SaveOrderKind, string> = {
  listed: "",
  removed: "table-dark",
  variant: "table-secondary",
};

const rowOf = (song: SongRow): SaveOrderRow => ({
  classes: CLASSES[kindOf(song)],
  generation: song.generation,
  ...(song.saveIndex === undefined ? {} : { index: song.saveIndex }),
  indexText: song.saveIndex === undefined ? "—" : String(song.saveIndex),
  kind: kindOf(song),
  songId: song.songId,
  title: song.title,
});

/**
 * 記録の枠を持たない曲を置く位置。
 * まず、同じ原作で枠を持ち、song_idがこの曲より小さい曲を集める。
 * 記録の枠がない曲は、集めた曲をすべて並べた後に置く。
 * 該当する曲が無ければ、その原作の最初の曲の前に置く。
 * 原作の曲が1曲も枠を持たなければ、表の最後に置く
 */
function positionOf(row: SaveOrderRow, listed: readonly Placed[]): number {
  const same = listed.filter((each) => each.row.generation === row.generation);
  const before = same.filter((each) => each.row.songId < row.songId);
  if (before.length > 0) {
    return Math.max(...before.map(({ position }) => position)) + 0.5;
  }
  if (same.length > 0) {
    return Math.min(...same.map(({ position }) => position)) - 0.5;
  }
  return Number.MAX_SAFE_INTEGER;
}

/**
 * 同じ曲は1行にまとめる。裏エントリーの曲は、表の曲ごとに行を持つからである。
 * 選曲リストに並ぶ行と裏の行の両方を持つ曲は、選曲リストに並ぶ行を残す
 */
function uniqueRows(songs: readonly SongRow[]): SaveOrderRow[] {
  const rows = new Map<string, SaveOrderRow>();
  for (const row of songs.map(rowOf)) {
    const key = row.generation + ":" + row.songId;
    if (rows.get(key)?.kind !== "listed") {
      rows.set(key, row);
    }
  }
  return [...rows.values()];
}

const withoutSlot = (row: SaveOrderRow): SaveOrderRow => {
  const { index: _, ...rest } = row;
  return {
    ...rest,
    classes: CLASSES.variant,
    indexText: "—",
    kind: "variant",
  };
};

/**
 * PBの曲を裏にして別の版の曲を表にすると、表の曲はPBの曲の記録の枠を使う。
 * この枠はPBの曲の記録なので、PBの曲の行に出す。表の曲の行は「—」にして、原作のsong_idの並びに置く。
 * PBの曲は曲indexとsong_idが同じなので、PBの曲の行はsong_idで引く
 */
function withPbSlots(rows: readonly SaveOrderRow[]): SaveOrderRow[] {
  const pbIds = new Set(
    rows.filter((row) => row.generation === "pb").map((row) => row.songId),
  );
  const borrowed = new Set(
    rows.flatMap((row) =>
      row.generation !== "pb" && row.index !== undefined &&
        pbIds.has(row.index)
        ? [row.index]
        : []
    ),
  );
  return rows.map((row) => {
    if (row.generation !== "pb") {
      return row.index !== undefined && borrowed.has(row.index)
        ? withoutSlot(row)
        : row;
    }
    return borrowed.has(row.songId)
      ? {
        ...row,
        classes: CLASSES.listed,
        index: row.songId,
        indexText: String(row.songId),
        kind: "listed",
      }
      : row;
  });
}

export function saveOrderRows(songs: readonly SongRow[]): SaveOrderRow[] {
  const rows = withPbSlots(uniqueRows(songs));
  const listed = rows.flatMap((row): Placed[] =>
    row.index === undefined ? [] : [{ position: row.index, row }]
  );
  const others = rows
    .filter((row) => row.index === undefined)
    .map((row): Placed => ({ position: positionOf(row, listed), row }));
  return [...listed, ...others]
    .sort((a, b) =>
      a.position - b.position ||
      a.row.generation.localeCompare(b.row.generation) ||
      a.row.songId - b.row.songId
    )
    .map(({ row }) => row);
}
