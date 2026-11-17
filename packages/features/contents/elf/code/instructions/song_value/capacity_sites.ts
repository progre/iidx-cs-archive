/**
 * 項目容量`C`に連動する確保sizeと即値のsite。配列の配置は layout.ts にある。
 */

import {
  ITEM_LOW_DELTA,
  type ItemLayout,
  resolveDelta,
  ROW_OFFSETS_LENGTH,
  ROW_OFFSETS_OFFSET,
} from "./layout.ts";

export type AllocationSite = Readonly<{
  /** 確保sizeを作る命令の位置。 */
  address: number;
  /** 末尾へ並べる容量`C`の配列本数。項目下位・上位・modeで3、flagsまたは2本目で4。 */
  arrays: number;
  itemsOffset: number;
  name: string;
  oldSize: number;
  /** list contextは配列群の後ろに行オフセット配列`int[C]`も持つ。 */
  rowOffsets?: true;
}>;

export const ALLOCATION_SITES: readonly AllocationSite[] = [
  {
    address: 0x153a94,
    arrays: 3,
    itemsOffset: 0x1f4,
    name: "ownerA",
    oldSize: 0x5dc,
  },
  {
    address: 0x153fd4,
    arrays: 3,
    itemsOffset: 0xe4,
    name: "scene",
    oldSize: 0x820,
  },
  {
    address: 0x154044,
    arrays: 3,
    itemsOffset: 0x54,
    name: "ownerB",
    oldSize: 0x478,
  },
  {
    address: 0x166f84,
    arrays: 4,
    itemsOffset: 0x0,
    name: "listA",
    oldSize: 0x1650,
    rowOffsets: true,
  },
  {
    address: 0x18e2d0,
    arrays: 4,
    itemsOffset: 0x814,
    name: "state",
    oldSize: 0x94c,
  },
  {
    address: 0x18e61c,
    arrays: 4,
    itemsOffset: 0x0,
    name: "listScene",
    oldSize: 0x1650,
    rowOffsets: true,
  },
  {
    address: 0x1b0da4,
    arrays: 4,
    itemsOffset: 0x0,
    name: "listB",
    oldSize: 0x1650,
    rowOffsets: true,
  },
  {
    address: 0x1b6118,
    arrays: 3,
    itemsOffset: 0xc,
    name: "ownerCList",
    oldSize: 0x5e0,
  },
  {
    address: 0x1b6124,
    arrays: 4,
    itemsOffset: 0x0,
    name: "listC",
    oldSize: 0x1650,
    rowOffsets: true,
  },
];

export function newAllocationSize(
  site: AllocationSite,
  layout: ItemLayout,
): number {
  const units = site.arrays + (site.rowOffsets ? 4 : 0);
  const end = site.itemsOffset + ITEM_LOW_DELTA + units * layout.capacity;
  return (end + 15) & ~15;
}

export type ImmediateSite = Readonly<{
  address: number;
  /** 元の16bit即値。 */
  old: number;
  value: (layout: ItemLayout) => number;
}>;

/**
 * 行オフセット配列`+0x634`を`L+位置*4`から引く4つの関数の命令。
 * 即値を移設先へずらす。
 */
const ROW_OFFSET_SITES: readonly ImmediateSite[] = [
  0x1d7f5c,
  0x1d7f64,
  0x1d802c,
  0x1d844c,
  0x1d89fc,
  0x1d8a00,
  0x1d8abc,
  0x1d8ac0,
  0x1d8b64,
  0x1da014,
  0x1da018,
  0x1da0c4,
  0x1da0c8,
  0x1da15c,
].map((address) => ({
  address,
  old: ROW_OFFSETS_OFFSET,
  value: (l: ItemLayout) => ROW_OFFSETS_OFFSET + resolveDelta(l, "rows"),
}));

/**
 * 容量に連動する即値。memset長の`0x1f1`と`0x1ef`(特殊項目2つを除く)、
 * 8バイト単位で埋めるループ上限の`0x1e9`、末尾呼び出しでflags配列を指す`addiu`、
 * 行オフセット配列の位置とmemset長`0x7c4`。
 */
export const IMMEDIATE_SITES: readonly ImmediateSite[] = [
  { address: 0x1d8428, old: 0x1f1, value: (l) => l.capacity },
  { address: 0x1d8438, old: 0x1f1, value: (l) => l.capacity },
  { address: 0x1d8448, old: 0x1f1, value: (l) => l.capacity },
  { address: 0x1d8458, old: ROW_OFFSETS_LENGTH, value: (l) => l.capacity * 4 },
  { address: 0x1d85a0, old: 0x1e9, value: (l) => l.capacity - 8 },
  { address: 0x1d8638, old: 0x1e9, value: (l) => l.capacity - 8 },
  {
    address: 0x1dae9c,
    old: 0x3e2,
    value: (l) => 0x3e2 + resolveDelta(l, "flags"),
  },
  { address: 0x1db02c, old: 0x1e9, value: (l) => l.capacity - 8 },
  { address: 0x20ecf4, old: 0x1ef, value: (l) => l.capacity - 2 },
  { address: 0x20ed04, old: 0x1ef, value: (l) => l.capacity - 2 },
  ...ROW_OFFSET_SITES,
];
