/**
 * セーブモジュール#10(score)を曲数に広げた配置。原盤の領域順を保ち、
 * 曲stride(要素size×曲数)と、その上位軸(row、style)のstrideを曲数に比例させる。
 */

import {
  type Coordinate,
  FIXED_REGIONS,
  locate,
  PB_SONGS,
  type Region,
  regionSize,
  SONG_REGIONS,
} from "./regions.ts";

export type SaveLayout = Readonly<{
  allocation: number;
  saveSize: number;
  songs: number;
  /** 領域名 -> 新しい開始offset。 */
  starts: ReadonlyMap<string, number>;
}>;

const align4 = (value: number) => (value + 3) & ~3;

/** 領域を原盤と同じ順に並べ直す。byte表の後ろは4バイト境界に詰める。 */
export function makeSaveLayout(songs: number): SaveLayout {
  if (!Number.isInteger(songs) || songs < PB_SONGS) {
    throw new Error("曲数は99以上の整数で指定する");
  }
  const starts = new Map<string, number>();
  let cursor = 0;
  const place = (name: string, size: number) => {
    starts.set(name, cursor);
    cursor += size;
  };
  const song = (name: string) => {
    const region = SONG_REGIONS.find((candidate) => candidate.name === name);
    if (region === undefined) throw new Error("領域がありません: " + name);
    place(name, regionSize(region, songs));
  };
  const fixed = (name: string) => {
    const region = FIXED_REGIONS.find((candidate) => candidate.name === name);
    if (region === undefined) throw new Error("領域がありません: " + name);
    place(name, region.size);
  };
  // empの記録の表は、PBの記録の表と同じ位置に重ねる。CSAのセーブはempが読まない。
  const overlay = (name: string) => starts.set(name, cursor);
  fixed("vtable");
  overlay("tableA");
  song("tableB");
  song("bytes");
  const padStart = cursor;
  cursor = align4(cursor);
  starts.set("pad", padStart);
  overlay("tableC");
  song("tableD");
  song("aux");
  fixed("savedScalars");
  const saveSize = cursor - 4;
  fixed("runtimeScalars");
  overlay("cacheE");
  song("cacheF");
  return { allocation: cursor, saveSize, songs, starts };
}

function songRegion(name: string): Region | undefined {
  return SONG_REGIONS.find((candidate) => candidate.name === name);
}

/** 座標を新配置のoffsetに写す。 */
function offsetOf(layout: SaveLayout, coordinate: Coordinate): number {
  const start = layout.starts.get(coordinate.region);
  if (start === undefined) {
    throw new Error("領域がありません: " + coordinate.region);
  }
  const region = songRegion(coordinate.region);
  if (region === undefined) return start + coordinate.within;
  const rowStride = region.element * layout.songs;
  return start + coordinate.style * rowStride * region.rows +
    coordinate.row * rowStride + coordinate.song * region.element +
    coordinate.within;
}

/** 原盤のoffsetを新配置のoffsetに写す。領域外はnull。 */
export function mapOffset(layout: SaveLayout, offset: number): number | null {
  const coordinate = locate(offset);
  return coordinate === null ? null : offsetOf(layout, coordinate);
}

/**
 * 曲stride由来の即値。99の倍数で、商が要素size(1、4、0x1c、0x50)またはその
 * row数倍(4行)のものだけを曲数に比例させる。商が合わない即値は要素内の差なので変えない。
 */
const STRIDE_QUOTIENTS: ReadonlySet<number> = new Set([
  1,
  4,
  0x1c,
  0x50,
  4 * 4,
  4 * 0x1c,
  4 * 0x50,
]);

export function isStride(value: number): boolean {
  return value > 0 && value % PB_SONGS === 0 &&
    STRIDE_QUOTIENTS.has(value / PB_SONGS);
}

export function scaleStride(layout: SaveLayout, value: number): number {
  if (!isStride(value)) {
    throw new Error("strideではない即値: 0x" + value.toString(16));
  }
  return (value / PB_SONGS) * layout.songs;
}
