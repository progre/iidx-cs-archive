/**
 * 曲数で伸びる6領域だけをワーク末尾へ移した配置。前方は詰める。
 * cacheAはstatesの28バイト後ろに並ぶ。
 * このため、両者の番地を1つの`lui`から作る関数は、どのN、Eでも正しい番地を得る。
 * 移した表の後ろに、追加のバージョン別フォルダーのレコード5本を置く。
 * 原盤のバージョン別フォルダーは、レコード`1 + 5×枠 + 側`を引く。
 * 5本はこの式の枠`k`に当たる位置へ置くので、枠番号をkへ差し替えれば原盤のコードで引ける。
 */

import type { DirectKind } from "./allowlist/mod.ts";
import {
  makeWorkLayout,
  minimumRecordSize,
  type WorkLayout,
  type WorkRegion,
} from "./layout.ts";

const APPENDED_KINDS: readonly DirectKind[] = [
  "cacheA",
  "songDifficulty",
  "cacheB",
  "cacheC",
  "secondaryA",
  "secondaryB",
];
const PB_STRUCT_SIZE = 0x37d50;
// 曲×難易度表とcacheは1曲20バイト、二次表は5group分の100バイトを持つ。
const APPENDED_WIDTHS = new Map<DirectKind, number>([
  ["cacheA", 20],
  ["cacheB", 20],
  ["cacheC", 20],
  ["secondaryA", 100],
  ["secondaryB", 100],
  ["songDifficulty", 20],
]);

const FOLDER_RECORDS = 5;

/** 追加のバージョン別フォルダーの枠番号。レコード`1 + 5k`が`tableEnd`以降に来る最小の`k` */
export function addedFolderSlot(tableEnd: number, recordSize: number): number {
  return Math.ceil(
    (tableEnd - recordSize) / (FOLDER_RECORDS * recordSize),
  );
}

/** 枠`k`の側0のレコードのワーク内offset */
export const addedFolderStart = (slot: number, recordSize: number): number =>
  (1 + FOLDER_RECORDS * slot) * recordSize;

// lw offsetは符号付きのため、下位が0x8000以上なら上位を1つ繰り上げて届かせる。
const luiHigh = (value: number) => (value + 0x8000) >>> 16;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function requireRegion(layout: WorkLayout, kind: DirectKind): WorkRegion {
  const region = layout.regions.find((candidate) => candidate.kind === kind);
  if (region === undefined) throw new Error("領域がありません: " + kind);
  return region;
}

function appendTables(
  regions: WorkRegion[],
  target: WorkLayout,
  start: number,
): number {
  let cursor = start;
  for (const kind of APPENDED_KINDS) {
    const source = requireRegion(target, kind);
    const size = source.end - source.start;
    regions.push({ end: cursor + size, kind, start: cursor });
    cursor += size;
  }
  return cursor;
}

export function makeAppendLayout(
  songs: number,
  entries: number,
  recordSize?: number,
  wide = false,
): WorkLayout {
  const target = makeWorkLayout(
    songs,
    entries,
    recordSize ?? minimumRecordSize(entries, wide),
    wide,
  );
  const regions: WorkRegion[] = [];
  let cursor = 0;
  for (const region of target.regions) {
    if (APPENDED_KINDS.includes(region.kind)) continue;
    const size = region.end - region.start;
    regions.push({ end: cursor + size, kind: region.kind, start: cursor });
    cursor += size;
  }
  const tableEnd = appendTables(regions, target, cursor);
  const slot = addedFolderSlot(tableEnd, target.recordSize);
  return {
    ...target,
    addedFolderSlot: slot,
    regions,
    structSize: addedFolderStart(slot, target.recordSize) +
      FOLDER_RECORDS * target.recordSize,
  };
}

export function verifyAppendLayout(layout: WorkLayout): void {
  const wide = layout.songIndexHighOffset !== undefined;
  const target = makeWorkLayout(
    layout.songs,
    layout.entries,
    layout.recordSize,
    wide,
  );
  assert(
    layout.recordSize >= minimumRecordSize(layout.entries, wide),
    "record長がEぶんの配列を保持できません",
  );
  let cursor = 0;
  for (const region of target.regions) {
    if (APPENDED_KINDS.includes(region.kind)) continue;
    const placed = requireRegion(layout, region.kind);
    assert(
      placed.start >= cursor,
      "前方memberが重なっています: " + region.kind,
    );
    assert(
      placed.end - placed.start === region.end - region.start,
      "前方memberの容量がN、Eから導出されていません: " + region.kind,
    );
    cursor = placed.end;
  }
  for (const kind of APPENDED_KINDS) {
    const placed = requireRegion(layout, kind);
    const width = APPENDED_WIDTHS.get(kind);
    if (width === undefined) throw new Error("曲数表の曲あたり幅がありません");
    assert(placed.start === cursor, "曲数表がwork末尾で連続していません");
    assert(
      placed.end - placed.start === width * layout.songs,
      "曲数表の容量が曲数へ追従していません: " + kind,
    );
    cursor = placed.end;
  }
  const slot = addedFolderSlot(cursor, layout.recordSize);
  assert(
    layout.addedFolderSlot === slot,
    "追加フォルダーの枠が表の直後の最小値でありません",
  );
  assert(
    layout.structSize ===
      addedFolderStart(slot, layout.recordSize) +
        FOLDER_RECORDS * layout.recordSize,
    "append構造体終端が追加フォルダーのレコード終端と一致しません",
  );
  assert(layout.structSize >= PB_STRUCT_SIZE, "構造体が原盤より縮んでいます");
  // statesとcacheAを1つのluiから作る関数がある。分離に使える空き命令がない。
  const states = requireRegion(layout, "states");
  const cacheA = requireRegion(layout, "cacheA");
  assert(
    luiHigh(states.start + 4) === luiHigh(cacheA.start),
    "statesとcacheAへ同じluiで届きません",
  );
  for (const region of layout.regions) {
    assert(
      region.start >= 0 && region.end <= layout.structSize,
      "領域が確保範囲を越えています: " + region.kind,
    );
  }
}
