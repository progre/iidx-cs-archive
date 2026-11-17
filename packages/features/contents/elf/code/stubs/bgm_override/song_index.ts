// 裏を選んだ演奏で、譜面・ムービー・音を裏の曲から読ませる。
// 原作の上書き曲indexは、キー音・BGM・曲名カード・演奏画面の曲名資産だけを裏の曲から引く。
// そこで、今の曲index(`0x2021b0`)を呼んで曲DBの欄を読む関数のうち、資産を読む呼び出しを、
// 使う曲indexを返すstubの呼び出しに置き換える。スコアと差し替えの判定の呼び出しは置き換えない。
// 置き換える位置はPB実測である。

import type { MutableElf } from "../../../elf/mod.ts";
import {
  addiu,
  assemble,
  bltz,
  bne,
  branchTo,
  jal,
  jr,
  lw,
  mark,
  move,
  NOP,
  pairWords,
  reg,
  sw,
} from "../../mips/mod.ts";
import { STUB_SLOTS } from "../../../data/stub_area/mod.ts";
import { OVERRIDE_GP_OFFSET, PB } from "./parts.ts";
import { OVERRIDE_FRONT } from "./table.ts";

export const SONG_INDEX_SLOT = STUB_SLOTS.bgmSongIndexCode;

/** 置き換える`jal 0x2021b0`の位置と、その関数が読む欄 */
const SITES: readonly (readonly [number, string])[] = [
  [0x1dea48, "オーバーレイの有無 +0x64・+0x66"],
  [0x1debf8, "+0xbd"],
  [0x1dec88, "+0xbc"],
  [0x1decec, "ムービーの映し方 +0x62"],
  [0x1dedb8, "ムービーの映し方 +0x62"],
  [0x1dee08, "ムービーの同期 +0x60"],
  [0x1dee58, "ムービー +0x58・+0x5c"],
  [0x1dee98, "ムービー +0x5c"],
  [0x1def80, "譜面"],
  [0x1df03c, "BGM"],
  [0x1df0dc, "キー音"],
];

const FRAME = 0x20;
const RA = 0x1c;

/** 今の曲が上書き曲indexを書いたときの表の曲なら、上書き曲indexを返す。そうでなければ今の曲indexを返す */
export const songIndexStubWords = (): number[] =>
  assemble([
    addiu(reg.sp, reg.sp, -FRAME),
    sw(reg.ra, RA, reg.sp),
    jal(PB.songIndex),
    NOP,
    lw(reg.t0, OVERRIDE_GP_OFFSET, reg.gp),
    branchTo(bltz(reg.t0, 0), "current"),
    NOP,
    ...pairWords(reg.t1, OVERRIDE_FRONT),
    lw(reg.t1, 0, reg.t1),
    branchTo(bne(reg.t1, reg.v0, 0), "current"),
    NOP,
    move(reg.v0, reg.t0),
    mark("current"),
    lw(reg.ra, RA, reg.sp),
    addiu(reg.sp, reg.sp, FRAME),
    jr(reg.ra),
    NOP,
  ]);

/** 置き換える位置が原盤のままの`jal 0x2021b0`であることを確かめてから置き換える */
export function redirectSongIndex(elf: MutableElf): void {
  for (const [site] of SITES) {
    if (elf.u32(site) !== jal(PB.songIndex)) {
      throw new Error(`0x${site.toString(16)}が今の曲indexの呼び出しでない`);
    }
    elf.setU32(site, jal(SONG_INDEX_SLOT.vaddr));
  }
}

export function verifySongIndexRedirect(elf: MutableElf): void {
  for (const [site] of SITES) {
    if (elf.u32(site) !== jal(SONG_INDEX_SLOT.vaddr)) {
      throw new Error(`0x${site.toString(16)}の呼び出しが置き換わっていない`);
    }
  }
}
