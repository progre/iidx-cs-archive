/**
 * Statistics画面の集計(`FUN_0015f530`)を、CSAの曲で数えるようにする。
 * 原盤の集計は、曲DBの曲を数えた後に、empの曲の譜面の数を即値で分母へ足す。
 * 分子には、empの記録の表(表A)のクリアも足す。
 * CSAでは表Aは表Bと同じ位置にあるので、表Aを読む後半を飛ばす。
 */

import type { MutableElf } from "../../elf/mod.ts";
import { type CsaSongDb, entryAddressOf } from "../../data/content/mod.ts";
import type { SongContent } from "../../model/mod.ts";
import { beq, immOf, opOf, withImmediate } from "../mips/mod.ts";
import {
  CATEGORIES,
  type Category,
  type StatisticsSong,
  totalAdjustments,
} from "./totals.ts";

const ADDIU = 0x09;
const SLTI = 0x0a;

/** 分母へempの譜面の数を足す`addiu`と、原盤の即値 */
const DENOMINATOR_ADDS: Record<Category, { address: number; pb: number }> = {
  sp_normal: { address: 0x160d14, pb: 99 },
  sp_hyper: { address: 0x160d1c, pb: 99 },
  sp_another: { address: 0x160d24, pb: 97 },
  sp_black: { address: 0x160d2c, pb: 24 },
  dp_normal: { address: 0x160d4c, pb: 99 },
  dp_hyper: { address: 0x160d40, pb: 99 },
  dp_another: { address: 0x160d48, pb: 94 },
  dp_black: { address: 0x160d80, pb: 20 },
};

/** 表Aを読む後半の先頭(`slti v1,s0,6`)と、曲のループの次の曲へ進む命令 */
const TABLE_A_PART = 0x160c00;
const NEXT_SONG = 0x160cb0;
const SKIP_TABLE_A = beq(0, 0, (NEXT_SONG - (TABLE_A_PART + 4)) / 4);

function songsOf(
  elf: MutableElf,
  songDb: CsaSongDb,
  content: SongContent,
  songCount: number,
): StatisticsSong[] {
  // 裏エントリーのスコアは、表の曲の枠に保存する
  const unsaved = new Set(
    content.songs
      .filter((song) => song.variantOf != null)
      .map((song) => song.targetSongIndex),
  );
  // 集計はレベルを`lb`で符号付きに読む
  const levelOf = (index: number, category: Category) => {
    const at = entryAddressOf(songDb, index) +
      songDb.format.levelFieldOffset(category);
    return (elf.slice(at, 1)[0] << 24) >> 24;
  };
  return Array.from({ length: songCount }, (_, index) => ({
    levels: Object.fromEntries(
      CATEGORIES.map((category) => [category, levelOf(index, category)]),
    ),
    saved: !unsaved.has(index),
  }));
}

function assertPb(elf: MutableElf, address: number, op: number, imm: number) {
  const word = elf.u32(address);
  if (opOf(word) !== op || immOf(word) !== imm) {
    throw new Error(
      `Statisticsの集計の0x${address.toString(16)}が原盤の命令でない`,
    );
  }
}

export function writeStatisticsTotals(
  elf: MutableElf,
  songDb: CsaSongDb,
  content: SongContent,
  songCount: number,
): void {
  const adds = totalAdjustments(songsOf(elf, songDb, content, songCount));
  for (const category of CATEGORIES) {
    const { address, pb } = DENOMINATOR_ADDS[category];
    assertPb(elf, address, ADDIU, pb);
    elf.setU32(address, withImmediate(elf.u32(address), adds[category]));
  }
  assertPb(elf, TABLE_A_PART, SLTI, 6);
  elf.setU32(TABLE_A_PART, SKIP_TABLE_A);
}

export function verifyStatisticsTotals(
  elf: MutableElf,
  songDb: CsaSongDb,
  content: SongContent,
  songCount: number,
): void {
  const adds = totalAdjustments(songsOf(elf, songDb, content, songCount));
  const wrong = CATEGORIES.filter((category) =>
    immOf(elf.u32(DENOMINATOR_ADDS[category].address)) !== adds[category]
  );
  if (wrong.length > 0 || elf.u32(TABLE_A_PART) !== SKIP_TABLE_A) {
    throw new Error(`Statisticsの集計が書いた値と違う: ${wrong.join(", ")}`);
  }
}
