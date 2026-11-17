// 規則ごとの判定コード。`t0`に表の行、フレームに`select`と`result`が入った状態で始まり、
// `result`を決めて`write`へ抜ける。

import {
  addiu,
  always,
  beq,
  bne,
  branchTo,
  divu,
  lw,
  mark,
  mfhi,
  NOP,
  type Piece,
  reg,
  sw,
  xori,
} from "../../mips/mod.ts";
import { bothSides, nextRandom, PB, SLOT, WRITE } from "./parts.ts";
import { fieldOffset } from "./table.ts";

/** 主の裏を結果にする */
const takePrimary = (): Piece[] => [
  lw(reg.t1, fieldOffset("primary"), reg.t0),
  sw(reg.t1, SLOT.result, reg.sp),
];

/** 副の裏を結果にする */
const takeSecondary = (): Piece[] => [
  lw(reg.t1, fieldOffset("secondary"), reg.t0),
  sw(reg.t1, SLOT.result, reg.sp),
];

/** 乱数を法で割った余りが0でなければ`elsewhere`へ抜ける */
const skipUnlessRandomHits = (elsewhere: string): Piece[] => [
  ...nextRandom(),
  lw(reg.t2, fieldOffset("param"), reg.t0),
  divu(reg.v0, reg.t2),
  mfhi(reg.t1),
  branchTo(bne(reg.t1, reg.zero, 0), elsewhere),
  NOP,
];

/** emp: SELECTを押していれば常に裏 */
export const alwaysRule = (label: string): Piece[] => [
  mark(label),
  lw(reg.t1, SLOT.select, reg.sp),
  branchTo(beq(reg.t1, reg.zero, 0), WRITE),
  NOP,
  ...takePrimary(),
  ...always(WRITE),
];

/** dd: SELECTを押すたびに裏表が入れ替わる。押さなければ前回のまま */
export function alternateRule(label: string): Piece[] {
  const read = label + "Read";
  return [
    mark(label),
    lw(reg.t1, SLOT.select, reg.sp),
    branchTo(beq(reg.t1, reg.zero, 0), read),
    NOP,
    lw(reg.t1, fieldOffset("state"), reg.t0),
    xori(reg.t1, reg.t1, 1),
    sw(reg.t1, fieldOffset("state"), reg.t0),
    mark(read),
    lw(reg.t1, fieldOffset("state"), reg.t0),
    branchTo(beq(reg.t1, reg.zero, 0), WRITE),
    NOP,
    ...takePrimary(),
    ...always(WRITE),
  ];
}

/**
 * gold: 乱数が当たれば裏。SELECTを押していれば方向キーで確定させる。
 * djt と違い、方向キーを押していなければ乱数の結果を据え置く。
 */
export function randomRule(label: string): Piece[] {
  const select = label + "Select";
  const directionB = label + "DirectionB";
  return [
    mark(label),
    ...skipUnlessRandomHits(select),
    ...takePrimary(),

    mark(select),
    lw(reg.t1, SLOT.select, reg.sp),
    branchTo(beq(reg.t1, reg.zero, 0), WRITE),
    NOP,
    ...bothSides(PB.directionA, SLOT.dirA),
    ...bothSides(PB.directionB, SLOT.dirB),
    lw(reg.t0, SLOT.row, reg.sp),
    lw(reg.t1, SLOT.dirA, reg.sp),
    branchTo(beq(reg.t1, reg.zero, 0), directionB),
    NOP,
    ...takePrimary(),
    ...always(WRITE),

    mark(directionB),
    lw(reg.t1, SLOT.dirB, reg.sp),
    branchTo(beq(reg.t1, reg.zero, 0), WRITE),
    NOP,
    addiu(reg.t1, reg.zero, -1),
    sw(reg.t1, SLOT.result, reg.sp),
    ...always(WRITE),
  ];
}

/**
 * djt: 直前にtriggerの曲を演奏していれば主、でなければ乱数で副。
 * SELECTを押していれば方向キーで3状態(方向A=副、方向B=主、無し=表)を選ぶ。
 */
export function tripleRule(label: string): Piece[] {
  const random = label + "Random";
  const select = label + "Select";
  const directionB = label + "DirectionB";
  const none = label + "None";
  return [
    mark(label),
    lw(reg.t1, fieldOffset("state"), reg.t0),
    branchTo(beq(reg.t1, reg.zero, 0), random),
    NOP,
    sw(reg.zero, fieldOffset("state"), reg.t0),
    ...takePrimary(),
    ...always(select),

    mark(random),
    ...skipUnlessRandomHits(select),
    ...takeSecondary(),

    mark(select),
    lw(reg.t1, SLOT.select, reg.sp),
    branchTo(beq(reg.t1, reg.zero, 0), WRITE),
    NOP,
    ...bothSides(PB.directionA, SLOT.dirA),
    ...bothSides(PB.directionB, SLOT.dirB),
    // 呼び出しで壊れた行の位置を戻す
    lw(reg.t0, SLOT.row, reg.sp),
    lw(reg.t1, SLOT.dirA, reg.sp),
    branchTo(beq(reg.t1, reg.zero, 0), directionB),
    NOP,
    ...takeSecondary(),
    ...always(WRITE),

    mark(directionB),
    lw(reg.t1, SLOT.dirB, reg.sp),
    branchTo(beq(reg.t1, reg.zero, 0), none),
    NOP,
    ...takePrimary(),
    ...always(WRITE),

    mark(none),
    addiu(reg.t1, reg.zero, -1),
    sw(reg.t1, SLOT.result, reg.sp),
    ...always(WRITE),
  ];
}
