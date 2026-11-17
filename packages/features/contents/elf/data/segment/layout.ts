/**
 * 曲数で伸びる表を写す高位PT_LOADの配置。
 * 曲DB・ABC表・DATA1のポインタ表とTOCを確保件数ぶん並べ、候補曲indexリストを続け、
 * 追加コードのstub領域を固定addressへ置く。
 */

import { STUB_ALLOCATION, STUB_BASE } from "../stub_area/mod.ts";
import { PB_SONG_COUNT, type SongCapacity } from "../../model/mod.ts";

/** 高位PT_LOADの先頭。128MB RAMのスタック底。 */
export const SEGMENT_VADDR = 0x7f00000;
/** 原盤のABC表とDATA1の件数。移設では先頭からこの件数だけを写す。 */
export const PB_ABC_COUNT = 1066;
export const PB_DATA1_COUNT = 1469;
/** 原盤のDATA1 TOC。既存indexの行は移設先と原盤側の両方を書き換える。 */
export const PB_DATA1_TOC_VADDR = 0x239900;
/** 使わない容量を埋める値。ヒープの食い込みをこの値で見分ける。 */
export const CANARY = 0xcb;

export type RegionName =
  | "abc"
  | "candidateList"
  | "data1Pointers"
  | "data1Toc"
  | "songDb"
  | "stubs";

interface Relocation {
  count: number;
  entrySize: number;
  name: RegionName;
  sourceVaddr: number;
}

/** `songEntrySize`は曲DBエントリー1件の長さ */
const relocationsOf = (songEntrySize: number): readonly Relocation[] => [
  {
    count: PB_SONG_COUNT,
    entrySize: songEntrySize,
    name: "songDb",
    sourceVaddr: 0x27e070,
  },
  { count: PB_ABC_COUNT, entrySize: 0xc, name: "abc", sourceVaddr: 0x240e10 },
  {
    count: PB_DATA1_COUNT,
    entrySize: 4,
    name: "data1Pointers",
    sourceVaddr: 0x23f4d0,
  },
  {
    count: PB_DATA1_COUNT,
    entrySize: 0x10,
    name: "data1Toc",
    sourceVaddr: PB_DATA1_TOC_VADDR,
  },
];

export interface SegmentPart {
  bytes: number;
  /** 確保した範囲を埋める値。移設する表は写した後ろがカナリアのまま残る。 */
  fill?: number;
  /** 原盤から写すバイト数。 */
  liveBytes: number;
  name: RegionName;
  sourceVaddr?: number;
  vaddr: number;
}

export interface SegmentLayout {
  parts: readonly SegmentPart[];
  /** 曲DBエントリー1件の長さ */
  songEntrySize: number;
  totalBytes: number;
  vaddr: Readonly<Record<RegionName, number>>;
}

const align16 = (value: number) => (value + 15) & ~15;

function entriesOf(name: RegionName, capacity: SongCapacity): number {
  if (name === "songDb") return capacity.songDbCapacity;
  if (name === "abc") return capacity.abcCapacity;
  return capacity.data1Capacity;
}

/** `songEntrySize`は曲DBエントリー1件の長さ */
export function segmentLayout(
  capacity: SongCapacity,
  songEntrySize: number,
): SegmentLayout {
  const parts: SegmentPart[] = [];
  let cursor = 0;
  for (const relocation of relocationsOf(songEntrySize)) {
    const entries = entriesOf(relocation.name, capacity);
    if (entries < relocation.count) {
      throw new Error(`${relocation.name}の確保件数が原盤の件数より少ない`);
    }
    cursor = align16(cursor);
    parts.push({
      bytes: entries * relocation.entrySize,
      liveBytes: relocation.count * relocation.entrySize,
      name: relocation.name,
      sourceVaddr: relocation.sourceVaddr,
      vaddr: SEGMENT_VADDR + cursor,
    });
    cursor += entries * relocation.entrySize;
  }
  cursor = align16(cursor);
  parts.push({
    bytes: capacity.candidateListBytes,
    // 候補曲indexリストの空き枠は終端の0xFFFFで埋める
    fill: 0xff,
    liveBytes: 0,
    name: "candidateList",
    vaddr: SEGMENT_VADDR + cursor,
  });
  cursor = align16(cursor + capacity.candidateListBytes);
  if (SEGMENT_VADDR + cursor > STUB_BASE) {
    throw new Error("移設した表がstubの基底を超える");
  }
  parts.push({
    bytes: STUB_ALLOCATION,
    fill: 0,
    liveBytes: 0,
    name: "stubs",
    vaddr: STUB_BASE,
  });
  const vaddr = Object.fromEntries(
    parts.map((part) => [part.name, part.vaddr]),
  ) as Record<RegionName, number>;
  return {
    parts,
    songEntrySize,
    totalBytes: align16(STUB_BASE - SEGMENT_VADDR + STUB_ALLOCATION),
    vaddr,
  };
}
