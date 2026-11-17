// 候補の印を立てた後に、鳴らす曲を選ぶ。結果を決めて`write`へ抜ける。
// 表の曲が持たない難易度なら、候補の先頭にする。
// SELECT を押していれば、一緒に押した上下と L1・R1 で選ぶ。押していなければ、1/8 で裏にし、候補から均等に選ぶ。

import {
  addiu,
  addu,
  always,
  and,
  beq,
  bne,
  branchTo,
  divu,
  lh,
  lw,
  mark,
  mfhi,
  NOP,
  type Piece,
  reg,
  sll,
  srl,
  srlv,
  sw,
} from "../../../mips/mod.ts";
import { bothSides, nextRandom, PB } from "../parts.ts";
import { BUTTON, CALL, LABEL, LEVELS, SLOT } from "./frame.ts";
import { LIST_FIELDS } from "./table.ts";

/**
 * 行の`forced`に選んだ難易度のビットが立っていれば、`forcedBack`番目の裏にする。
 * その裏が無いか候補でなければ、候補の先頭の裏にする。
 * 候補が無ければ表の曲のまま。立っていなければ`select`へ
 */
const forced = (): Piece[] => [
  mark(LABEL.forced),
  lw(reg.t0, SLOT.row, reg.sp),
  lh(reg.t1, LIST_FIELDS.forced, reg.t0),
  lw(reg.t2, SLOT.levelOffset, reg.sp),
  addiu(reg.t2, reg.t2, -LEVELS),
  srlv(reg.t1, reg.t1, reg.t2),
  addiu(reg.t2, reg.zero, 1),
  and(reg.t1, reg.t1, reg.t2),
  branchTo(beq(reg.t1, reg.zero, 0), LABEL.select),
  NOP,
  lw(reg.t4, SLOT.candidates, reg.sp),
  branchTo(beq(reg.t4, reg.zero, 0), LABEL.write),
  NOP,
  lw(reg.t0, SLOT.row, reg.sp),
  lh(reg.t1, LIST_FIELDS.forcedBack, reg.t0),
  addiu(reg.t2, reg.zero, -1),
  branchTo(beq(reg.t1, reg.t2, 0), "forcedFirst"),
  NOP,
  sll(reg.t8, reg.t1, 2),
  addu(reg.t9, reg.t8, reg.sp),
  lw(reg.t1, SLOT.flags, reg.t9),
  branchTo(beq(reg.t1, reg.zero, 0), "forcedFirst"),
  NOP,
  ...takeBack(),
  mark("forcedFirst"),
  // `random`の数え上げに、0番目の候補を取らせる
  addiu(reg.t3, reg.zero, 0),
  addiu(reg.t8, reg.zero, 0),
  ...always("pick"),
];

/**
 * 鳴らす曲を決める。`t8`は、何曲目の裏かを4倍した値である。
 * 行の中には、曲indexが2バイトずつ並ぶ
 */
const takeBack = (): Piece[] => [
  lw(reg.t0, SLOT.row, reg.sp),
  srl(reg.t9, reg.t8, 1),
  addu(reg.t9, reg.t9, reg.t0),
  lh(reg.t1, LIST_FIELDS.backs, reg.t9),
  sw(reg.t1, SLOT.result, reg.sp),
  ...always(LABEL.write),
];

/** ボタン語(`CALL.buttons`)の`bit`が立っていれば、`t4`に`step`を足す */
const stepIf = (bit: number, step: number, skip: string): Piece[] => [
  lw(reg.t2, SLOT.buttons, reg.sp),
  addiu(reg.t3, reg.zero, bit),
  and(reg.t1, reg.t2, reg.t3),
  branchTo(beq(reg.t1, reg.zero, 0), skip),
  NOP,
  addiu(reg.t4, reg.t4, step),
  mark(skip),
];

/**
 * SELECT を押していれば、上で`t4`番目、下で`t4 + 1`番目の裏にする。
 * `t4`は0から始め、L1 を押していれば2を、R1 なら4を足す。
 * 上も下も押していなければ表の曲のまま
 */
const selected = (): Piece[] => [
  mark(LABEL.select),
  ...bothSides(PB.selectPressed, SLOT.select),
  lw(reg.t1, SLOT.select, reg.sp),
  branchTo(beq(reg.t1, reg.zero, 0), LABEL.random),
  NOP,
  ...bothSides(CALL.up, SLOT.up),
  ...bothSides(CALL.down, SLOT.down),
  ...bothSides(CALL.buttons, SLOT.buttons),
  addiu(reg.t4, reg.zero, 0),
  ...stepIf(BUTTON.l1, 2, "noL1"),
  ...stepIf(BUTTON.r1, 4, "noR1"),
  lw(reg.t1, SLOT.up, reg.sp),
  branchTo(bne(reg.t1, reg.zero, 0), "chosen"),
  NOP,
  addiu(reg.t4, reg.t4, 1),
  lw(reg.t1, SLOT.down, reg.sp),
  branchTo(bne(reg.t1, reg.zero, 0), "chosen"),
  NOP,
  ...always(LABEL.write),
  // 選んだ裏が候補でなければ(無いか、譜面を持たなければ)表の曲のまま
  mark("chosen"),
  sll(reg.t8, reg.t4, 2),
  addu(reg.t9, reg.t8, reg.sp),
  lw(reg.t1, SLOT.flags, reg.t9),
  branchTo(beq(reg.t1, reg.zero, 0), LABEL.write),
  NOP,
  ...takeBack(),
];

/** 乱数の下位3ビットがすべて0のとき(1/8)だけ裏にし、候補の中から乱数で1つを選ぶ */
const random = (): Piece[] => [
  mark(LABEL.random),
  ...nextRandom(),
  addiu(reg.t2, reg.zero, 7),
  and(reg.t3, reg.v0, reg.t2),
  branchTo(bne(reg.t3, reg.zero, 0), LABEL.write),
  NOP,
  lw(reg.t4, SLOT.candidates, reg.sp),
  branchTo(beq(reg.t4, reg.zero, 0), LABEL.write),
  NOP,
  srl(reg.v0, reg.v0, 3),
  divu(reg.v0, reg.t4),
  mfhi(reg.t3),
  // 候補の印を前から数え、`t3`番目の候補を取る
  addiu(reg.t8, reg.zero, 0),
  mark("pick"),
  addu(reg.t9, reg.t8, reg.sp),
  lw(reg.t1, SLOT.flags, reg.t9),
  branchTo(beq(reg.t1, reg.zero, 0), "pickNext"),
  NOP,
  branchTo(beq(reg.t3, reg.zero, 0), "picked"),
  NOP,
  addiu(reg.t3, reg.t3, -1),
  mark("pickNext"),
  addiu(reg.t8, reg.t8, 4),
  ...always("pick"),
  mark("picked"),
  ...takeBack(),
];

export const pick = (): Piece[] => [...forced(), ...selected(), ...random()];
