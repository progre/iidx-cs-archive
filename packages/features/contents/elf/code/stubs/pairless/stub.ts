// 組を持たない曲の判定・読み込みstub。命令列は`mips/assemble.ts`の配列方式で書く。

import {
  addiu,
  always,
  assemble,
  beq,
  bltz,
  branchTo,
  j,
  jr,
  lw,
  mark,
  NOP,
  pairWords,
  type Piece,
  reg,
  sw,
} from "../../mips/mod.ts";
import {
  fieldOffset,
  LOAD_CONTINUE,
  PACKAGE_TABLE_ADDR,
  PACKAGE_TO_DESCRIPTOR_OFFSET,
  ROW_SIZE,
  TABLE,
} from "./table.ts";

/** `a0`の曲DB indexで表を引き、あれば1、無ければ0を`v0`へ置く葉関数 */
export function matcherWords(): number[] {
  const pieces: Piece[] = [
    ...pairWords(reg.t0, TABLE),
    mark("scan"),
    lw(reg.t1, fieldOffset("songIndex"), reg.t0),
    branchTo(bltz(reg.t1, 0), "notFound"),
    NOP,
    branchTo(beq(reg.t1, reg.a0, 0), "found"),
    NOP,
    addiu(reg.t0, reg.t0, ROW_SIZE),
    ...always("scan"),
    mark("notFound"),
    addiu(reg.v0, reg.zero, 0),
    ...always("done"),
    mark("found"),
    addiu(reg.v0, reg.zero, 1),
    mark("done"),
    jr(reg.ra),
    NOP,
  ];
  return assemble(pieces);
}

/**
 * `s0`(呼び手が読み込み済みの曲DB index)で表を引く。見つかればパッケージと記述子を
 * 原盤の表へ書く。見つかっても見つからなくても、枠0を書く原盤の続きへ戻る。
 */
export function loaderWords(): number[] {
  const pieces: Piece[] = [
    ...pairWords(reg.t0, TABLE),
    mark("scan"),
    lw(reg.t1, fieldOffset("songIndex"), reg.t0),
    branchTo(bltz(reg.t1, 0), "finish"),
    NOP,
    branchTo(beq(reg.t1, reg.s0, 0), "found"),
    NOP,
    addiu(reg.t0, reg.t0, ROW_SIZE),
    ...always("scan"),
    mark("found"),
    lw(reg.t2, fieldOffset("packageIndex"), reg.t0),
    lw(reg.t3, fieldOffset("descriptor"), reg.t0),
    ...pairWords(reg.t4, PACKAGE_TABLE_ADDR),
    sw(reg.t2, 0, reg.t4),
    sw(reg.t3, PACKAGE_TO_DESCRIPTOR_OFFSET, reg.t4),
    mark("finish"),
    j(LOAD_CONTINUE),
    addiu(reg.v0, reg.zero, 0),
  ];
  return assemble(pieces);
}
