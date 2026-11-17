// 裏のうち、選んだ難易度の譜面を持つもの(曲DBのレベル欄が0でないもの)に、候補の印を立てる。
// `t0`に表の行が入った状態で始まり、`forced`へ抜ける。SP・DP でなければ`select`へ抜ける。

import {
  addiu,
  addu,
  always,
  beq,
  branchTo,
  jal,
  lb,
  lh,
  lw,
  mark,
  move,
  mult,
  NOP,
  pairWords,
  type Piece,
  reg,
  sll,
  sltiu,
  sw,
} from "../../../mips/mod.ts";
import { CALL, LABEL, LEVELS, SLOT, type SongDbAddress } from "./frame.ts";
import { LIST_FIELDS } from "./table.ts";

/** 選んだ難易度と SP・DP から、レベル欄の位置を求める。SP・DP でなければ候補を作らない */
const levelOffset = (): Piece[] => [
  jal(CALL.difficulty),
  NOP,
  sw(reg.v0, SLOT.rank, reg.sp),
  jal(CALL.playerOf),
  NOP,
  move(reg.a0, reg.v0),
  jal(CALL.side),
  NOP,
  move(reg.a0, reg.v0),
  jal(CALL.style),
  NOP,
  sltiu(reg.t1, reg.v0, 2),
  branchTo(beq(reg.t1, reg.zero, 0), LABEL.select),
  NOP,
  sll(reg.t1, reg.v0, 2),
  addu(reg.t1, reg.t1, reg.v0),
  lw(reg.t2, SLOT.rank, reg.sp),
  addu(reg.t1, reg.t1, reg.t2),
  addiu(reg.t1, reg.t1, LEVELS),
  sw(reg.t1, SLOT.levelOffset, reg.sp),
];

/** 裏ごとに、曲DBのレベル欄が0でなければ候補の印を立て、候補の数を数える */
export const candidates = (songDb: SongDbAddress): Piece[] => [
  ...levelOffset(),
  lw(reg.t0, SLOT.row, reg.sp),
  lh(reg.t3, LIST_FIELDS.count, reg.t0),
  addiu(reg.t4, reg.zero, 0),
  mark("candidate"),
  branchTo(beq(reg.t4, reg.t3, 0), LABEL.forced),
  NOP,
  // 表の裏の曲indexは2バイトずつ、フレームの候補の印は4バイトずつ並ぶ
  sll(reg.t9, reg.t4, 1),
  addu(reg.t9, reg.t9, reg.t0),
  lh(reg.a1, LIST_FIELDS.backs, reg.t9),
  sll(reg.t8, reg.t4, 2),
  addiu(reg.a2, reg.zero, songDb.recordLength),
  mult(reg.a3, reg.a1, reg.a2),
  ...pairWords(reg.a2, songDb.vaddr),
  addu(reg.a3, reg.a3, reg.a2),
  lw(reg.a2, SLOT.levelOffset, reg.sp),
  addu(reg.a3, reg.a3, reg.a2),
  lb(reg.a3, 0, reg.a3),
  branchTo(beq(reg.a3, reg.zero, 0), "candidateNext"),
  NOP,
  addu(reg.t9, reg.t8, reg.sp),
  addiu(reg.a2, reg.zero, 1),
  sw(reg.a2, SLOT.flags, reg.t9),
  lw(reg.a2, SLOT.candidates, reg.sp),
  addiu(reg.a2, reg.a2, 1),
  sw(reg.a2, SLOT.candidates, reg.sp),
  mark("candidateNext"),
  addiu(reg.t4, reg.t4, 1),
  ...always("candidate"),
];
