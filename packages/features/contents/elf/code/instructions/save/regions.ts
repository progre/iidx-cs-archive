/**
 * セーブモジュール#10(score)の原盤配置。offsetを領域と座標(style、row、曲、要素内)に
 * 分解する。
 */

export const PB_SONGS = 99;

export type Region = Readonly<{
  /** 要素size。byte表は1。 */
  element: number;
  name: string;
  /** row数。曲strideの上位軸。 */
  rows: number;
  start: number;
  /** style数。rowの上位軸。 */
  styles: number;
}>;

/** 曲数に比例する領域。開始offsetは99曲のときの値。 */
export const SONG_REGIONS: readonly Region[] = [
  { element: 0x1c, name: "tableA", rows: 4, start: 0x4, styles: 3 },
  { element: 0x1c, name: "tableB", rows: 4, start: 0x81f4, styles: 3 },
  { element: 1, name: "bytes", rows: 18, start: 0x103e4, styles: 1 },
  { element: 0x50, name: "tableC", rows: 4, start: 0x10adc, styles: 2 },
  { element: 0x50, name: "tableD", rows: 4, start: 0x2025c, styles: 2 },
  { element: 1, name: "aux", rows: 4, start: 0x2f9dc, styles: 1 },
  { element: 4, name: "cacheE", rows: 4, start: 0x2fbac, styles: 2 },
  { element: 4, name: "cacheF", rows: 4, start: 0x3080c, styles: 2 },
];

/** 曲数に依らない領域。byte表の後ろの詰め物2バイトとscalar群。 */
export const FIXED_REGIONS: readonly Readonly<
  { name: string; size: number; start: number }
>[] = [
  { name: "vtable", size: 4, start: 0x0 },
  { name: "pad", size: 2, start: 0x10ada },
  { name: "savedScalars", size: 0x10, start: 0x2fb68 },
  { name: "runtimeScalars", size: 0x34, start: 0x2fb78 },
];

export type Coordinate = Readonly<{
  region: string;
  row: number;
  song: number;
  style: number;
  within: number;
}>;

export function regionSize(region: Region, songs: number): number {
  return region.element * songs * region.rows * region.styles;
}

/** 原盤の領域開始offset。 */
const PB_STARTS: ReadonlyMap<string, number> = new Map([
  ...SONG_REGIONS.map((region) => [region.name, region.start] as const),
  ...FIXED_REGIONS.map((region) => [region.name, region.start] as const),
]);

/** 99曲配置のoffsetを座標に分解する。曲数に依らない領域は`region`名だけを返す。 */
export function locate(offset: number): Coordinate | null {
  for (const region of SONG_REGIONS) {
    const start = PB_STARTS.get(region.name);
    if (start === undefined) continue;
    const size = regionSize(region, PB_SONGS);
    if (offset < start || offset >= start + size) continue;
    const rowStride = region.element * PB_SONGS;
    const styleStride = rowStride * region.rows;
    const relative = offset - start;
    return {
      region: region.name,
      row: Math.floor((relative % styleStride) / rowStride),
      song: Math.floor((relative % rowStride) / region.element),
      style: Math.floor(relative / styleStride),
      within: relative % region.element,
    };
  }
  for (const fixed of FIXED_REGIONS) {
    const start = PB_STARTS.get(fixed.name);
    if (start === undefined) continue;
    if (offset >= start && offset < start + fixed.size) {
      return {
        region: fixed.name,
        row: 0,
        song: 0,
        style: 0,
        within: offset - start,
      };
    }
  }
  return null;
}
