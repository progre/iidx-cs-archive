// 5鍵盤版の切り替えでstubが引く対の表と、コード・状態語・表の置き場。

import type { SongContent } from "../../../model/mod.ts";
import { STUB_SLOTS } from "../../../data/stub_area/mod.ts";

export const CODE_SLOT = STUB_SLOTS.fiveKeysCode;
/** 「使う側が5KEYSか」の0/1。充填の0がそのまま初期値になる */
export const STATE_SLOT = STUB_SLOTS.fiveKeysState;
export const TABLE_SLOT = STUB_SLOTS.fiveKeysTable;
export const FIVE_KEYS_STATE = STATE_SLOT.vaddr;
export const TWIN_TABLE = TABLE_SLOT.vaddr;

/** 行の語。`front`が表の曲index、`twin`が5鍵盤版の曲index */
export const ROW_FIELDS = ["front", "twin"] as const;
export const ROW_SIZE = ROW_FIELDS.length * 4;
export const fieldOffset = (name: typeof ROW_FIELDS[number]): number =>
  ROW_FIELDS.indexOf(name) * 4;

export interface TwinRow {
  front: number;
  twin: number;
}

/** `fiveKeyFrontIndex`を持つ曲ごとに1行。`front`の昇順に並べる */
export function twinRows(content: SongContent): TwinRow[] {
  return content.songs
    .filter((song) => song.fiveKeyFrontIndex !== undefined)
    .map((song) => ({
      front: song.fiveKeyFrontIndex as number,
      twin: song.targetSongIndex,
    }))
    .sort((a, b) => a.front - b.front);
}

/** 表のバイト列。`front`が`-1`の終端行で終わる */
export function twinTableBytes(content: SongContent): Uint8Array {
  const rows = twinRows(content);
  const bytes = new Uint8Array((rows.length + 1) * ROW_SIZE);
  const view = new DataView(bytes.buffer);
  [...rows, { front: -1, twin: -1 }].forEach((row, index) => {
    const at = index * ROW_SIZE;
    view.setInt32(at + fieldOffset("front"), row.front, true);
    view.setInt32(at + fieldOffset("twin"), row.twin, true);
  });
  return bytes;
}
