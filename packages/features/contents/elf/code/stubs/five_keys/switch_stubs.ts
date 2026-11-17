// 5KEYSの設定が変わった瞬間に選曲リストを作り直す2つのstub。

import {
  addu,
  always,
  assemble,
  beq,
  bltz,
  bne,
  branchTo,
  jal,
  jr,
  lw,
  mark,
  NOP,
  pairWords,
  reg,
  sw,
  xori,
} from "../../mips/mod.ts";
import { DONE, enter, leave, lookup, PB, SLOT, stateValue } from "./parts.ts";
import { FIVE_KEYS_STATE } from "./table.ts";

/** 選曲画面のscene(`s2`)が持つ3本の選曲ワーク */
const WORK_OFFSETS = [0xc8, 0xcc, 0xd0];
/** 同じsceneの、フォルダーを開く前に控えたカーソルの曲index */
const CURSOR_SOURCE = 0x68;
/** 写し先のオブジェクトの欄 */
const CURSOR_TARGET = 0x24;

/**
 * 組み直しの契機。原盤の判定値をそのまま返すが、5KEYSが前フレームから
 * 変わっていれば選曲ワークを作り直し、呼び手の写し`+0xc0`と食い違う値を返して
 * 既存の組み直しへ入れる。
 */
export function rebuildStubWords(): number[] {
  const changed = "changed";
  return assemble([
    ...enter(),
    jal(PB.doubleMode),
    NOP,
    sw(reg.v0, SLOT.value, reg.sp),
    ...stateValue(),
    ...pairWords(reg.t0, FIVE_KEYS_STATE),
    lw(reg.t1, 0, reg.t0),
    lw(reg.t2, SLOT.state, reg.sp),
    branchTo(bne(reg.t1, reg.t2, 0), changed),
    NOP,
    lw(reg.v0, SLOT.value, reg.sp),
    ...always(DONE),
    mark(changed),
    sw(reg.t2, 0, reg.t0),
    ...WORK_OFFSETS.flatMap((offset) => [
      lw(reg.a0, offset, reg.s2),
      jal(PB.buildWork),
      NOP,
    ]),
    lw(reg.v0, SLOT.value, reg.sp),
    xori(reg.v0, reg.v0, 1),
    mark(DONE),
    ...leave(),
  ]);
}

/**
 * カーソルの写し。控えた曲indexを今の5KEYSに合う側へ読み替えてから写す。
 * 呼び出しをしないのでフレームは要らない。
 */
export function cursorStubWords(): number[] {
  const toFront = "toFront";
  const store = "store";
  const keep = "keep";
  return assemble([
    lw(reg.t2, CURSOR_SOURCE, reg.s2),
    ...pairWords(reg.t0, FIVE_KEYS_STATE),
    lw(reg.t1, 0, reg.t0),
    branchTo(beq(reg.t1, reg.zero, 0), toFront),
    NOP,
    ...lookup("toTwin", "front", "twin"),
    ...always(store),
    mark(toFront),
    ...lookup("toFront", "twin", "front"),
    mark(store),
    branchTo(bltz(reg.v0, 0), keep),
    NOP,
    addu(reg.t2, reg.v0, reg.zero),
    mark(keep),
    sw(reg.t2, CURSOR_TARGET, reg.a0),
    addu(reg.v0, reg.t2, reg.zero),
    jr(reg.ra),
    NOP,
  ]);
}
