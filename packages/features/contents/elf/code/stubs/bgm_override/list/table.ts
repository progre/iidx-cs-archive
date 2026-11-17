// 全曲リストで足した裏エントリー(規則`custom`)の表。表の曲1曲に8曲まで裏が付く。
// 置き場に収めるため、行の値は16ビットで持つ。
// 原作の組は`../table.ts`の表が持つ。

import type { SongContent } from "../../../../model/mod.ts";
import { STUB_SLOTS } from "../../../../data/stub_area/mod.ts";
import { levelIndexOf } from "./frame.ts";

export const LIST_CODE_SLOT = STUB_SLOTS.bgmListCode;
export const LIST_TABLE_SLOT = STUB_SLOTS.bgmListTable;
export const LIST_STUB = LIST_CODE_SLOT.vaddr;
export const LIST_TABLE = LIST_TABLE_SLOT.vaddr;

/** 表の曲1曲に付けられる裏の数 */
export const MAX_BACKS = 8;

/**
 * 行の中の2バイトの値の位置。`backs`は`MAX_BACKS`個続き、裏が無い位置は`-1`。
 * `forcedBack`は、表の曲が持たない難易度で鳴らす裏の番号で、無ければ`-1`
 */
export const LIST_FIELDS = {
  front: 0,
  count: 2,
  forced: 4,
  backs: 6,
  forcedBack: 6 + MAX_BACKS * 2,
} as const;
/** 表を語の列で書くので、行の長さを4の倍数にそろえる */
export const LIST_ROW_SIZE = Math.ceil((LIST_FIELDS.forcedBack + 2) / 4) * 4;

export interface ListRow {
  /** 裏の曲index。`position`の順に並ぶ */
  backs: number[];
  /**
   * 表の曲が持たず、裏の曲で出す難易度(`front_charts`)の印。
   * ビット`style*5 + rank`が立っていれば、その難易度では必ず裏を選ぶ
   */
  forced: number;
  /** 表の曲が持たない難易度で鳴らす裏の番号。無ければ`-1` */
  forcedBack: number;
  front: number;
}

/** エラーで曲を示す。曲DBエントリーの先頭は管理名で、NULで終わる */
function titleOf(content: SongContent, index: number | undefined): string {
  const song = content.songs.find((each) => each.targetSongIndex === index);
  if (song?.entry === undefined) {
    return String(index ?? "-");
  }
  const end = song.entry.indexOf(0);
  const name = new TextDecoder().decode(
    song.entry.subarray(0, end < 0 ? 0x40 : Math.min(end, 0x40)),
  );
  return `${index}(${name})`;
}

/**
 * 表の曲ごとに1行。裏は`position`の順に並べる。
 * 同じ表の曲で`position`が重なるか、`MAX_BACKS`以上になれば、ビルドを止める
 */
export function listRows(content: SongContent): ListRow[] {
  const rows = new Map<
    number,
    { backs: number[]; forced: number; forcedBack: number }
  >();
  // PB原盤の曲の写しの裏は、PBの枠に置いた表の曲の裏になる
  const pbBacks = (content.pbBacks ?? []).map((back) => ({
    targetSongIndex: back.targetSongIndex,
    variantOf: {
      ...(back.forcedBack ? { forcedBack: back.forcedBack } : {}),
      ...(back.frontCharts ? { frontCharts: back.frontCharts } : {}),
      position: back.position,
      rule: "custom" as const,
      targetSongIndex: back.songId,
    },
  }));
  for (const song of [...content.songs, ...pbBacks]) {
    const variant = song.variantOf;
    if (variant?.rule !== "custom") continue;
    const position = variant.position ?? 0;
    const row = rows.get(variant.targetSongIndex) ??
      { backs: [], forced: 0, forcedBack: -1 };
    if (variant.forcedBack) {
      row.forcedBack = position;
    }
    if (position >= MAX_BACKS || row.backs[position] !== undefined) {
      throw new Error(
        `曲index ${variant.targetSongIndex}の${position}番目の裏が重なるか、上限を超える` +
          `(裏の曲 ${titleOf(content, row.backs[position])}と` +
          `${titleOf(content, song.targetSongIndex)})`,
      );
    }
    row.backs[position] = song.targetSongIndex;
    row.forced = Object.keys(variant.frontCharts ?? {})
      .reduce((bits, name) => bits | (1 << levelIndexOf(name)), row.forced);
    rows.set(variant.targetSongIndex, row);
  }
  return [...rows].map(([front, { backs, forced, forcedBack }]) => {
    // 番号が飛んだ位置は配列の穴になる。`some`は穴を飛ばすので、`Array.from`で埋めてから見る
    if (Array.from(backs).some((back) => back === undefined)) {
      throw new Error(`曲index ${front}の裏の番号が飛んでいる`);
    }
    return { backs, forced, forcedBack, front };
  }).sort((a, b) => a.front - b.front);
}

/** 表のバイト列。`front`が`-1`の終端行で終わる */
export function listTableBytes(content: SongContent): Uint8Array {
  const rows = listRows(content);
  const bytes = new Uint8Array((rows.length + 1) * LIST_ROW_SIZE);
  const view = new DataView(bytes.buffer);
  rows.forEach(({ backs, forced, forcedBack, front }, index) => {
    if ([front, ...backs].some((song) => song > 0x7fff)) {
      throw new Error(
        `曲index ${front}の行に、16ビットに収まらない曲indexがある`,
      );
    }
    const at = index * LIST_ROW_SIZE;
    view.setInt16(at + LIST_FIELDS.front, front, true);
    view.setInt16(at + LIST_FIELDS.count, backs.length, true);
    view.setInt16(at + LIST_FIELDS.forced, forced, true);
    view.setInt16(at + LIST_FIELDS.forcedBack, forcedBack, true);
    for (let position = 0; position < MAX_BACKS; position++) {
      view.setInt16(
        at + LIST_FIELDS.backs + position * 2,
        backs[position] ?? -1,
        true,
      );
    }
  });
  view.setInt16(rows.length * LIST_ROW_SIZE + LIST_FIELDS.front, -1, true);
  return bytes;
}
