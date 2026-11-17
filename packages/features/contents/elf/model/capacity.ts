/**
 * 曲数から、CSAのELFが確保する件数と容量を出す。
 * ここが曲数を受け取る唯一の入口で、以降の書き換えは`SongCapacity`だけを見る。
 */

import { planFor } from "../code/instructions/save/mod.ts";
import { recordSizeCandidates } from "../code/selector_work/rewrite/mod.ts";
import type { SongCapacity } from "./types.ts";

/** 原盤の曲数。複製で埋める先頭側。 */
export const PB_SONG_COUNT = 99;
/** 項目容量の下限。原盤は497。 */
const PB_ITEM_CAPACITY = 497;
/** 表の確保件数はこの倍数へ切り上げる。 */
const TABLE_GRAIN = 1024;
/** 据え置きの選曲record容量。 */
export const DEFAULT_RECORDS = 4300;

/** セーブ側の曲容量。曲数以上で、shift列が`S`倍と`5S`倍を4命令で作れる最小の値にする。 */
function saveCapacity(songCount: number): number {
  let capacity = songCount;
  while (planFor(capacity) === null || planFor(capacity * 5) === null) {
    capacity++;
  }
  return capacity;
}

/** 項目容量。選曲record容量`E`+2以上で、8で割って1余る最小値。 */
function itemCapacity(records: number): number {
  const least = Math.max(records + 2, PB_ITEM_CAPACITY);
  return least + ((1 - least % 8) % 8 + 8) % 8;
}

/** 表の確保件数。必要件数を`TABLE_GRAIN`の倍数へ切り上げる。 */
const tableCapacity = (needed: number): number =>
  Math.ceil(needed / TABLE_GRAIN) * TABLE_GRAIN;

export interface SongCapacityInput {
  /** ABC表の必要件数。原盤のぶんを含む。 */
  abcNeeded: number;
  /** DATA1の必要件数。原盤のぶんを含む。 */
  data1Needed: number;
  records?: number;
  /** 選べる曲数。原盤の99を含む。 */
  songCount: number;
  /** 選曲リストへ出さない裏エントリーの数。 */
  variants: number;
}

export function songCapacity(input: SongCapacityInput): SongCapacity {
  const records = input.records ?? DEFAULT_RECORDS;
  if (
    !Number.isInteger(input.songCount) || input.songCount < PB_SONG_COUNT
  ) {
    throw new Error(`曲数は${PB_SONG_COUNT}以上の整数で指定する`);
  }
  return {
    abcCapacity: tableCapacity(input.abcNeeded),
    // 曲indexのu16×曲数と、終端の2バイト
    candidateListBytes: input.songCount * 2 + 2,
    data1Capacity: tableCapacity(input.data1Needed),
    itemCapacity: itemCapacity(records),
    recordSize: recordSizeCandidates(records, 1, true)[0],
    records,
    saveCapacity: saveCapacity(input.songCount),
    songCount: input.songCount,
    // 選べる曲数に、選曲リストへ出さない裏エントリーと終端を足す
    songDbCapacity: input.songCount + input.variants + 1,
  };
}
