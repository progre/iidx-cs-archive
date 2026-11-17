// 曲ごとに表裏のどちらを採るかを決める2つのstub。

import {
  addu,
  always,
  assemble,
  beq,
  bltz,
  branchTo,
  jal,
  lw,
  mark,
  NOP,
  pairWords,
  reg,
  sw,
} from "../../mips/mod.ts";
import {
  DONE,
  enter,
  flags,
  leave,
  lookup,
  ONE,
  PB,
  SLOT,
  stateValue,
  ZERO,
} from "./parts.ts";
import { FIVE_KEYS_STATE } from "./table.ts";

/**
 * 登録判定。窓の内側という原作の条件に、5KEYSなら表を、でなければ裏を落とす判定を足す。
 * 選曲リストを組む4本の呼び手がこの1か所を通るので、ここで状態語も更新する。
 */
export function registerStubWords(): number[] {
  const notFront = "notFront";
  return assemble([
    ...enter(),
    sw(reg.a0, SLOT.song, reg.sp),
    jal(PB.songWindow),
    NOP,
    branchTo(beq(reg.v0, reg.zero, 0), ZERO),
    NOP,
    ...stateValue(),
    ...pairWords(reg.t0, FIVE_KEYS_STATE),
    lw(reg.t1, SLOT.state, reg.sp),
    sw(reg.t1, 0, reg.t0),
    lw(reg.t2, SLOT.song, reg.sp),
    ...lookup("front", "front", "twin"),
    branchTo(bltz(reg.v0, 0), notFront),
    NOP,
    lw(reg.t1, SLOT.state, reg.sp),
    branchTo(beq(reg.t1, reg.zero, 0), ONE),
    NOP,
    ...always(ZERO),
    mark(notFront),
    lw(reg.t2, SLOT.song, reg.sp),
    ...lookup("twin", "twin", "front"),
    branchTo(bltz(reg.v0, 0), ONE),
    NOP,
    lw(reg.t1, SLOT.state, reg.sp),
    branchTo(beq(reg.t1, reg.zero, 0), ZERO),
    NOP,
    ...always(ONE),
    ...flags(),
    ...leave(),
  ]);
}

/**
 * 5KEYSの判定`gate`(側を引数に取る)を包み、5KEYSでも現在曲が裏なら0を返す。
 * 原作どおり保存しない・アシスト扱いにする曲を、裏でない曲だけにする。
 */
function gateStubWords(gate: number): number[] {
  return assemble([
    ...enter(),
    jal(gate),
    NOP,
    branchTo(beq(reg.v0, reg.zero, 0), ZERO),
    NOP,
    jal(PB.songIndex),
    NOP,
    addu(reg.t2, reg.v0, reg.zero),
    ...lookup("twin", "twin", "front"),
    branchTo(bltz(reg.v0, 0), ONE),
    NOP,
    ...always(ZERO),
    ...flags(),
    ...leave(),
  ]);
}

/** 記録可否と記録種別。オプションの5KEYS設定を包む */
export const recordStubWords = (): number[] => gateStubWords(PB.fiveKeys);

/** スコアの書き込みとランプ種別。演奏側へ写した5KEYSを包む */
export const playStubWords = (): number[] => gateStubWords(PB.playFiveKeys);

/**
 * 5KEYSの欄の比較関数`(side, value)`を包む。現在曲が裏なら欄を0とみなして
 * `value == 0`を返し、でなければ原作の判定をそのまま通す。
 * リザルトのベストとの比較表示が、5KEYSの欄を直接見て表示を止めるのを外す。
 */
export function fieldStubWords(): number[] {
  const original = "original";
  return assemble([
    ...enter(),
    sw(reg.a0, SLOT.song, reg.sp),
    sw(reg.a1, SLOT.value, reg.sp),
    jal(PB.songIndex),
    NOP,
    addu(reg.t2, reg.v0, reg.zero),
    ...lookup("twin", "twin", "front"),
    branchTo(bltz(reg.v0, 0), original),
    NOP,
    lw(reg.t1, SLOT.value, reg.sp),
    branchTo(beq(reg.t1, reg.zero, 0), ONE),
    NOP,
    ...always(ZERO),
    mark(original),
    lw(reg.a0, SLOT.song, reg.sp),
    lw(reg.a1, SLOT.value, reg.sp),
    jal(PB.fiveKeysIs),
    NOP,
    ...always(DONE),
    ...flags(),
    ...leave(),
  ]);
}
