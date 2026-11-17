// オーバーレイの有無を返すPBの関数(`0x1dea40`)を、難易度を見て判断するstubへ置き換える。
// 原作(red・hs)は曲番号を比べて、一部の曲でオーバーレイをANOTHERのときだけ使う。
// stubは、表にある曲で難易度がANOTHERでなければ、オーバーレイ無しを返す。
// それ以外は、原作の`0x1dea40`と同じく曲DB`+0x64`・`+0x66`で有無を返す。

import {
  addiu,
  always,
  assemble,
  beq,
  bltz,
  bne,
  branchTo,
  jal,
  jr,
  lh,
  lw,
  mark,
  move,
  NOP,
  pairWords,
  reg,
  sw,
} from "../../mips/mod.ts";

/** 置き換えるPBの関数と、stubが呼ぶPBの関数 */
export const PB_OVERLAY = {
  /** オーバーレイの有無を返す関数。中で今の曲indexを`+8`の`jal`で引く */
  exists: 0x1dea40,
  /** 曲indexを引く`jal`の位置 */
  indexCall: 0x1dea48,
  /** 演奏中の難易度。2がANOTHER */
  difficulty: 0x202190,
  /** 曲DBの先頭を返す */
  songDbBase: 0x167c90,
  /** 曲DBの先頭と曲indexから、エントリーを返す */
  songEntry: 0x1dd850,
} as const;

/** ANOTHERを表す難易度 */
const ANOTHER = 2;
const FRAME = 0x20;
const RA = 0x1c;
const S0 = 0x18;

/**
 * `indexFunction`は、曲indexを返す関数。原作の`0x1dea40`が呼んでいた関数を渡す。
 * `table`は、オーバーレイをANOTHERのときだけ使う曲indexの表の先頭
 */
export const overlaySwitchStubWords = (
  indexFunction: number,
  table: number,
): number[] =>
  assemble([
    addiu(reg.sp, reg.sp, -FRAME),
    sw(reg.ra, RA, reg.sp),
    sw(reg.s0, S0, reg.sp),
    jal(indexFunction),
    NOP,
    move(reg.s0, reg.v0),
    ...pairWords(reg.t0, table),
    mark("search"),
    lw(reg.t1, 0, reg.t0),
    branchTo(bltz(reg.t1, 0), "read"),
    NOP,
    branchTo(beq(reg.t1, reg.s0, 0), "listed"),
    NOP,
    branchTo(beq(reg.zero, reg.zero, 0), "search"),
    addiu(reg.t0, reg.t0, 4),
    mark("listed"),
    jal(PB_OVERLAY.difficulty),
    NOP,
    addiu(reg.t1, reg.zero, ANOTHER),
    branchTo(bne(reg.v0, reg.t1, 0), "none"),
    NOP,
    mark("read"),
    jal(PB_OVERLAY.songDbBase),
    NOP,
    move(reg.a0, reg.v0),
    jal(PB_OVERLAY.songEntry),
    move(reg.a1, reg.s0),
    lh(reg.v1, 0x64, reg.v0),
    branchTo(bltz(reg.v1, 0), "second"),
    NOP,
    ...always("exists"),
    mark("second"),
    lh(reg.v1, 0x66, reg.v0),
    branchTo(bltz(reg.v1, 0), "none"),
    NOP,
    mark("exists"),
    addiu(reg.v0, reg.zero, 1),
    ...always("return"),
    mark("none"),
    move(reg.v0, reg.zero),
    mark("return"),
    lw(reg.s0, S0, reg.sp),
    lw(reg.ra, RA, reg.sp),
    jr(reg.ra),
    addiu(reg.sp, reg.sp, FRAME),
  ]);

/** 表の語。曲indexを並べ、`-1`で終える */
export const overlaySwitchTableWords = (
  songIndices: readonly number[],
): number[] => [...songIndices, -1 >>> 0];
