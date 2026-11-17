/**
 * 前段で上位16bitを作れなかった低位命令(`far_lo`)をstubの命令列に広げる。
 * 基底`rs`は割れた`lui`の値(`retainedHigh << 16`)を含むので、`at`に目的の上位16bitとの
 * 差を作って足し直す。`target`はwork先頭からの全offsetで、符号付き即値の繰り上がりは
 * `lui`側に含める。
 */

import {
  addiu,
  addu,
  decodeFields,
  lbu,
  ld,
  lui,
  or,
  ori,
  reg,
  sb,
  sd,
  sll,
  srl,
} from "../../mips/mod.ts";
import {
  fits16,
  OP_LB,
  OP_LBU,
  OP_SB,
  pickTemporaries,
  SPILL_FIRST,
  SPILL_SECOND,
} from "./widen.ts";

const highOf = (target: number) => ((target + 0x8000) >>> 16) & 0xffff;

/**
 * `far_lo`かつ曲値のsite。`at`に目的の上位16bitを持つ基底を作ってから、
 * `widen`と同じく上位と下位を合成または分割する。`delta`は上位配列までの距離。
 */
export function widenFar(
  word: number,
  target: number,
  retainedHigh: number,
  delta: number,
): readonly number[] {
  const { op, rs, rt } = decodeFields(word);
  if (rs === reg.sp || rs === reg.at || rt === reg.at) {
    throw new Error("far_loの基底または値が退避registerと重なる");
  }
  const low = (target << 16) >> 16;
  const [temp] = pickTemporaries([rs, rt, reg.at], 1);
  const prologue = [
    sd(reg.at, SPILL_FIRST, reg.sp),
    sd(temp, SPILL_SECOND, reg.sp),
    lui(reg.at, (highOf(target) - retainedHigh) & 0xffff),
    addu(reg.at, reg.at, rs),
  ];
  const epilogue = [
    ld(temp, SPILL_SECOND, reg.sp),
    ld(reg.at, SPILL_FIRST, reg.sp),
  ];
  if (op === OP_LB || op === OP_LBU) {
    const high = fits16(low + delta)
      ? [lbu(temp, low + delta, reg.at)]
      : [addiu(temp, reg.at, delta), lbu(temp, low, temp)];
    return [
      ...prologue,
      ...high,
      lbu(rt, low, reg.at),
      sll(temp, temp, 8),
      or(rt, rt, temp),
      ...epilogue,
    ];
  }
  if (op === OP_SB) {
    const high = fits16(low + delta)
      ? [sb(temp, low + delta, reg.at)]
      : [addiu(reg.at, reg.at, delta), sb(temp, low, reg.at)];
    return [
      ...prologue,
      sb(rt, low, reg.at),
      srl(temp, rt, 8),
      ...high,
      ...epilogue,
    ];
  }
  throw new Error("lb/lbu/sb以外の命令は広げられない: 0x" + word.toString(16));
}

/**
 * 定数を作る命令(`ori rt, zero, K`や`addiu rt, zero, K`、共有luiが割れた`ori rt, rt, lo`)の
 * `far_lo`。`rt`に定数全体を`lui`と`ori`で作り直す。基底registerは使わない。
 */
export function farConstant(word: number, target: number): readonly number[] {
  const { rt } = decodeFields(word);
  if (rt === reg.zero) {
    throw new Error("far_constantの宛先が不正: 0x" + word.toString(16));
  }
  return [lui(rt, target >>> 16), ori(rt, rt, target & 0xffff)];
}

/** 上位配列を持たない`far_lo`。元の命令を`at`基底で実行する。 */
export function far(
  word: number,
  target: number,
  retainedHigh: number,
): readonly number[] {
  const { rs, rt } = decodeFields(word);
  if (rs === reg.sp || rs === reg.at || rt === reg.at) {
    throw new Error("far_loの基底または値が退避registerと重なる");
  }
  const relocatedWord = (word & 0xfc1f0000) | (reg.at << 21) |
    (target & 0xffff);
  return [
    sd(reg.at, SPILL_FIRST, reg.sp),
    lui(reg.at, (highOf(target) - retainedHigh) & 0xffff),
    addu(reg.at, reg.at, rs),
    relocatedWord >>> 0,
    ld(reg.at, SPILL_FIRST, reg.sp),
  ];
}
