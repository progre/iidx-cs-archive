/**
 * 移設した表と候補曲indexリストの基底を作る`lui`と下位命令の組を、
 * 追加セグメントの中のaddressへ向け直す。
 */

import {
  type InstructionPatch,
  type MutableElf,
  requireWord,
} from "../../elf/mod.ts";
import { withImmediate } from "../../code/mips/mod.ts";
import type { SongCapacity } from "../../model/mod.ts";
import type { RegionName, SegmentLayout } from "./layout.ts";

export const BASE_ACTION = "relocate_base";

interface BaseSite {
  /** 基底からの距離。候補曲indexリストの終端を指す組だけ曲数から決まる。 */
  fieldOffset: number | "listEnd";
  hi: number;
  lo: number;
  region: RegionName;
}

/**
 * 曲DBの基底を作る`lui`と下位命令の組
 */
export const SONG_DB_BASE_PAIR = { hi: 0x1dd858, lo: 0x1dd85c } as const;

const SITES: readonly BaseSite[] = [
  { fieldOffset: 0, ...SONG_DB_BASE_PAIR, region: "songDb" },
  { fieldOffset: 0, hi: 0x14cf08, lo: 0x14cf0c, region: "abc" },
  { fieldOffset: 0, hi: 0x14d14c, lo: 0x14d150, region: "abc" },
  { fieldOffset: 4, hi: 0x14d15c, lo: 0x14d160, region: "abc" },
  { fieldOffset: 8, hi: 0x14d16c, lo: 0x14d170, region: "abc" },
  { fieldOffset: 4, hi: 0x132064, lo: 0x13206c, region: "abc" },
  { fieldOffset: 0, hi: 0x14d200, lo: 0x14d204, region: "data1Pointers" },
  { fieldOffset: 0, hi: 0x210dd4, lo: 0x210ddc, region: "candidateList" },
  { fieldOffset: 0, hi: 0x210e0c, lo: 0x210e14, region: "candidateList" },
  { fieldOffset: 0, hi: 0x210ea8, lo: 0x210eb0, region: "candidateList" },
  {
    fieldOffset: "listEnd",
    hi: 0x210dbc,
    lo: 0x210dd8,
    region: "candidateList",
  },
];

export function buildBasePatches(
  elf: MutableElf,
  capacity: SongCapacity,
  layout: SegmentLayout,
): InstructionPatch[] {
  const rows: InstructionPatch[] = [];
  for (const site of SITES) {
    const offset = site.fieldOffset === "listEnd"
      ? capacity.songCount * 2
      : site.fieldOffset;
    const target = (layout.vaddr[site.region] + offset) >>> 0;
    const shared = {
      action: BASE_ACTION,
      functionName: "",
      newReference: "0x" + target.toString(16),
      oldReference: "",
      rationale: site.region + "を追加セグメントへ移した",
      usage: site.region,
    };
    for (
      const [address, immediate, form] of [
        [site.hi, ((target + 0x8000) >>> 16) & 0xffff, "lui"],
        [site.lo, target & 0xffff, "low"],
      ] as const
    ) {
      const oldWord = requireWord(elf, address);
      rows.push({
        ...shared,
        address,
        newWord: withImmediate(oldWord, immediate),
        oldWord,
        referenceForm: form,
        sourceAddress: "0x" + address.toString(16),
      });
    }
  }
  return rows;
}
