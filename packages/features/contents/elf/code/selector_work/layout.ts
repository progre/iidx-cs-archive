/** 選曲ワーク構造体の配置。曲数`N`と選曲record容量`E`から領域の境界を決める。 */

import { type DirectKind, PB_REGIONS } from "./allowlist/mod.ts";

const PB_CACHE_C_THREE_FOUR_SONGS = 0x32cc4;
const PB_ENTRIES = 495;
const PB_RECORD_SIZE = 0x3e8;
const RECORD_COUNT = 192;

export type WorkRegion = Readonly<{
  end: number;
  kind: DirectKind;
  start: number;
}>;
export type WorkLayout = Readonly<{
  /**
   * 追加のバージョン別フォルダーの枠番号`k`。そのレコード5本(側ごと)を
   * `(1 + 5k) × record長`からワーク末尾に置く。append配置だけが持つ
   */
  addedFolderSlot?: number;
  entries: number;
  recordSize: number;
  regions: readonly WorkRegion[];
  songs: number;
  /**
   * 曲index配列の上位byte配列のrecord内offset。曲値を16bit化する配置だけが持ち、
   * 下位配列`+9+E`の直後`+9+2E`に置く。
   */
  songIndexHighOffset?: number;
  structSize: number;
}>;

const align4 = (value: number) => (value + 3) & ~3;
const hex = (value: number) => "0x" + (value >>> 0).toString(16);
/** 曲indexを16bit化するときは255曲を超えられる。全曲ビルドの目標1400曲を含む上限にする。 */
const MAX_SONGS_WIDE = 2048;

function requireRegion(layout: WorkLayout, kind: DirectKind): WorkRegion {
  const region = layout.regions.find((candidate) => candidate.kind === kind);
  if (region === undefined) throw new Error(`配置領域がありません: ${kind}`);
  return region;
}

/** record内配列の最小長。難易度E、曲index下位E、16bit化なら上位Eが続く。 */
export function minimumRecordSize(entries: number, wide: boolean): number {
  return align4(9 + entries * (wide ? 3 : 2));
}

// record長は最小値に固定しない。stride合成が5命令枠に収まる値を選べるようにする。
export function makeWorkLayout(
  songs: number,
  entries: number,
  recordSize = minimumRecordSize(entries, false),
  wide = false,
): WorkLayout {
  const maxSongs = wide ? MAX_SONGS_WIDE : 255;
  if (!Number.isInteger(songs) || songs < 99 || songs > maxSongs) {
    throw new Error(`Nは99以上${maxSongs}以下の整数で指定する`);
  }
  if (
    !Number.isInteger(entries) || entries < PB_ENTRIES || entries > songs * 5
  ) {
    throw new Error("Eは495以上5N以下の整数で指定する");
  }
  if (
    !Number.isInteger(recordSize) || (recordSize & 3) !== 0 ||
    recordSize < minimumRecordSize(entries, wide)
  ) {
    throw new Error(
      `record長は9+${wide ? 3 : 2}E以上の4バイト境界で指定する`,
    );
  }
  const regions: WorkRegion[] = [];
  let cursor = 0;
  const add = (kind: DirectKind, size: number) => {
    regions.push({ end: cursor + size, kind, start: cursor });
    cursor += size;
  };
  // record 0の先頭はwork baseと一致させる。フォルダー行の終端レコード複写などがwork pointerをそのまま
  // record 0として渡すので、record群の前へpaddingを置くことはできない。
  add("records", RECORD_COUNT * recordSize);
  add("table0", entries * 4);
  add("table1", entries * 4);
  add("table2", entries * 4);
  add("songDifficulty", songs * 20);
  add("terminalRecord", recordSize);
  add("table4", entries * 4);
  add("states", 20);
  add("cacheA", songs * 20);
  add("cacheB", songs * 20);
  add("cacheC", songs * 20);
  add("builtFlag", 4);
  add("secondaryA", songs * 100);
  add("secondaryB", songs * 100);
  add("tail", 24);
  const layout: WorkLayout = {
    entries,
    recordSize,
    regions,
    songs,
    structSize: cursor,
  };
  return wide ? { ...layout, songIndexHighOffset: 9 + entries * 2 } : layout;
}

function mapRecordOffset(within: number, layout: WorkLayout): number {
  const oldIndex = 9 + PB_ENTRIES;
  const oldDataEnd = 9 + PB_ENTRIES * 2;
  if (within < 0 || within >= PB_RECORD_SIZE) {
    throw new Error("record境界外の参照です: " + hex(within));
  }
  if (within < oldIndex) return within;
  if (within < oldDataEnd) return 9 + layout.entries + within - oldIndex;
  throw new Error("record paddingへの参照は写像できません: " + hex(within));
}

export function targetReference(
  layout: WorkLayout,
  kind: DirectKind,
  oldReference: number,
): number {
  if (kind === "allocation") return layout.structSize;
  if (kind === "entries") return layout.entries;
  if (kind === "externalListEntries") {
    if (oldReference !== PB_ENTRIES) {
      throw new Error(`外部リスト容量の参照が不正です: ${hex(oldReference)}`);
    }
    return PB_ENTRIES;
  }
  if (kind === "fiveRecords") return 5 * layout.recordSize;
  if (kind === "fourEntries") return 4 * layout.entries;
  if (kind === "recordSize") return layout.recordSize;
  if (kind === "twentySongs") return 20 * layout.songs;
  if (kind === "cacheCThreeFourSongs") {
    const cacheC = requireRegion(layout, "cacheC");
    if (oldReference !== PB_CACHE_C_THREE_FOUR_SONGS) {
      throw new Error(
        `cacheCThreeFourSongsの参照が不正です: ${hex(oldReference)}`,
      );
    }
    return cacheC.start + 3 * 4 * layout.songs;
  }
  const old = PB_REGIONS.find(([candidate]) => candidate === kind);
  const target = requireRegion(layout, kind);
  if (old === undefined || oldReference < old[1] || oldReference >= old[2]) {
    throw new Error(`${kind}の参照が領域外です: ${hex(oldReference)}`);
  }
  const relative = oldReference - old[1];
  if (kind === "records") {
    const record = Math.floor(relative / PB_RECORD_SIZE);
    const within = relative % PB_RECORD_SIZE;
    return target.start + record * layout.recordSize +
      mapRecordOffset(within, layout);
  }
  if (kind === "terminalRecord") {
    return target.start + mapRecordOffset(relative, layout);
  }
  return target.start + relative;
}
