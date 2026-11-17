// BGM差し替えstubの足場。フレームの割り当て、原作の判定関数、繰り返し使う小片。

import {
  addiu,
  jal,
  lw,
  NOP,
  or,
  pairWords,
  type Piece,
  reg,
  sll,
  srl,
  sw,
  xor,
} from "../../mips/mod.ts";
import { OVERRIDE_FRONT, STUB_SEED } from "./table.ts";

export const FRAME = 0x40;

/** 結果を書く手前と、何もせず戻る出口 */
export const WRITE = "write";
export const DONE = "done";

/** フレームに置く値。jalをまたぐとt/aレジスタは壊れるので、ここへ退避する */
export const SLOT = {
  current: 0x14,
  dirA: 0x18,
  dirB: 0x1c,
  ra: 0x30,
  result: 0x20,
  row: 0x24,
  select: 0x28,
} as const;

/**
 * 原作が持つ判定関数。モードと現在曲はgp相対の1語を返すだけだが、
 * 原作の呼び出しと対応づけるため、呼び出しとして書く。
 */
export const PB = {
  /** パッドワーク`+0x163`の方向キー */
  directionA: 0x13ae40,
  /** パッドワーク`+0x161`の方向キー */
  directionB: 0x13ae60,
  modeA: 0x2021d0,
  modeB: 0x2021f0,
  selectPressed: 0x13ad20,
  songIndex: 0x2021b0,
} as const;

/** 上書き曲indexのグローバル`0x2b1d54` */
export const OVERRIDE_GP_OFFSET = -0x7d9c;

/**
 * `t1`の裏の曲indexを上書き曲indexへ書き、そのときの表の曲index(フレームの`currentSlot`)も残す。
 * 使う曲indexを返すstubは、今の曲がこの表の曲のときだけ上書き曲indexを使う
 */
export const writeOverride = (currentSlot: number): Piece[] => [
  sw(reg.t1, OVERRIDE_GP_OFFSET, reg.gp),
  lw(reg.t2, currentSlot, reg.sp),
  ...pairWords(reg.t3, OVERRIDE_FRONT),
  sw(reg.t2, 0, reg.t3),
];

/** 側0と側1へ同じ判定を掛け、論理和をフレームへ置く */
export const bothSides = (target: number, slot: number): Piece[] => [
  addiu(reg.a0, reg.zero, 0),
  jal(target),
  NOP,
  sw(reg.v0, slot, reg.sp),
  addiu(reg.a0, reg.zero, 1),
  jal(target),
  NOP,
  lw(reg.t1, slot, reg.sp),
  or(reg.t1, reg.t1, reg.v0),
  sw(reg.t1, slot, reg.sp),
];

/**
 * xorshift32で`v0`に次の乱数を作る。原盤の乱数関数を特定していないのでstubが自前で持つ。
 * 種はstub領域の1語。`t0`(表の行)は壊さない。
 */
export const nextRandom = (): Piece[] => [
  ...pairWords(reg.t1, STUB_SEED),
  lw(reg.v0, 0, reg.t1),
  sll(reg.v1, reg.v0, 13),
  xor(reg.v0, reg.v0, reg.v1),
  srl(reg.v1, reg.v0, 17),
  xor(reg.v0, reg.v0, reg.v1),
  sll(reg.v1, reg.v0, 5),
  xor(reg.v0, reg.v0, reg.v1),
  sw(reg.v0, 0, reg.t1),
  // 符号bitを落として、剰余が負にならないようにする
  srl(reg.v0, reg.v0, 1),
];
