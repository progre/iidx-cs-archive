// 全曲リストで足した裏エントリー(規則`custom`)を選ぶstub。
// 差し替えの呼び出し位置から最初に呼ばれる。今の曲が`table.ts`の表に無ければ、原作の組のstubへ飛ぶ。

import {
  addiu,
  always,
  assemble,
  beq,
  bltz,
  bne,
  branchTo,
  j,
  jal,
  jr,
  lh,
  lw,
  mark,
  NOP,
  pairWords,
  type Piece,
  reg,
  sw,
} from "../../../mips/mod.ts";
import { PB, writeOverride } from "../parts.ts";
import { candidates } from "./candidates.ts";
import { FRAME, LABEL, SLOT, type SongDbAddress } from "./frame.ts";
import { pick } from "./pick.ts";
import { LIST_FIELDS, LIST_ROW_SIZE, LIST_TABLE, MAX_BACKS } from "./table.ts";

/** モード判定がどちらも0のときだけ続ける(原作empの条件)。そうでなければ原作の組のstubへ任せる */
const modeGate = (): Piece[] =>
  [PB.modeA, PB.modeB].flatMap((target) => [
    jal(target),
    NOP,
    branchTo(bne(reg.v0, reg.zero, 0), LABEL.pass),
    NOP,
  ]);

/** 今の曲で表を引き、見つかった行を`t0`に残す。無ければ原作の組のstubへ */
const scan = (): Piece[] => [
  jal(PB.songIndex),
  NOP,
  sw(reg.v0, SLOT.current, reg.sp),
  ...pairWords(reg.t0, LIST_TABLE),
  mark("scan"),
  lh(reg.t1, LIST_FIELDS.front, reg.t0),
  branchTo(bltz(reg.t1, 0), LABEL.pass),
  NOP,
  lw(reg.t2, SLOT.current, reg.sp),
  branchTo(beq(reg.t1, reg.t2, 0), "found"),
  NOP,
  addiu(reg.t0, reg.t0, LIST_ROW_SIZE),
  ...always("scan"),
];

/** フレームを戻して、原作の組のstubへ飛ぶ。戻り先は呼び出し位置のままなので、そのstubが戻す */
const pass = (fallback: number): Piece[] => [
  mark(LABEL.pass),
  lw(reg.ra, SLOT.ra, reg.sp),
  addiu(reg.sp, reg.sp, FRAME),
  j(fallback),
  NOP,
];

/** 結果を表の曲のままにし、候補の数と印を0にする */
const reset = (): Piece[] => [
  mark("found"),
  sw(reg.t0, SLOT.row, reg.sp),
  addiu(reg.t1, reg.zero, -1),
  sw(reg.t1, SLOT.result, reg.sp),
  sw(reg.zero, SLOT.candidates, reg.sp),
  ...Array.from(
    { length: MAX_BACKS },
    (_, index) => sw(reg.zero, SLOT.flags + index * 4, reg.sp),
  ),
];

/** `fallback`は原作の組のstubの先頭 */
export function listStubWords(
  songDb: SongDbAddress,
  fallback: number,
): number[] {
  return assemble([
    addiu(reg.sp, reg.sp, -FRAME),
    sw(reg.ra, SLOT.ra, reg.sp),
    ...modeGate(),
    ...scan(),
    ...pass(fallback),
    ...reset(),
    ...candidates(songDb),
    ...pick(),
    mark(LABEL.write),
    lw(reg.t1, SLOT.result, reg.sp),
    branchTo(bltz(reg.t1, 0), LABEL.done),
    NOP,
    ...writeOverride(SLOT.current),
    mark(LABEL.done),
    lw(reg.ra, SLOT.ra, reg.sp),
    addiu(reg.sp, reg.sp, FRAME),
    jr(reg.ra),
    NOP,
  ]);
}
