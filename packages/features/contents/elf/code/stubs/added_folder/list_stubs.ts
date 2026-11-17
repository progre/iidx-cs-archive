// 追加フォルダーをフォルダー一覧へ並べ、表示可否とRANDOMの扱いをバージョン別にそろえるスタブ。

import {
  addiu,
  assemble,
  beq,
  bne,
  branchTo,
  j,
  jr,
  mark,
  NOP,
  type Piece,
  reg,
  slti,
} from "../../mips/mod.ts";
import {
  ADDED_CATEGORY,
  GROUP_RETURN,
  GROUP_SITE,
  LIST_END,
  type ListLoop,
  PRECEDING_CATEGORY,
  RANDOM_BOUND,
  RANDOM_SITE,
  RANDOM_TAKEN,
  SELECT_FOLDER,
  SELECT_REST,
  SKIPPED_CATEGORY,
  VERSION_END,
  VERSION_GROUP,
} from "./sites.ts";

const jumpTo = (target: number): Piece[] => [j(target), NOP];

/**
 * 見終えた分類`r`から次の分類へ進む。
 * 前の分類の次は追加の分類、追加の分類の次は前の分類+1にする。並べない分類は飛ばす
 */
export function listLoopWords(loop: ListLoop): number[] {
  const r = loop.counter;
  return assemble([
    addiu(reg.at, reg.zero, PRECEDING_CATEGORY),
    branchTo(bne(r, reg.at, 0), "notPreceding"),
    NOP,
    addiu(r, reg.zero, ADDED_CATEGORY),
    ...jumpTo(loop.top),
    mark("notPreceding"),
    addiu(reg.at, reg.zero, ADDED_CATEGORY),
    branchTo(bne(r, reg.at, 0), "step"),
    NOP,
    addiu(r, reg.zero, PRECEDING_CATEGORY + 1),
    ...jumpTo(loop.top),
    mark("step"),
    addiu(r, r, 1),
    addiu(reg.at, reg.zero, SKIPPED_CATEGORY),
    branchTo(bne(r, reg.at, 0), "bound"),
    NOP,
    addiu(r, r, 1),
    mark("bound"),
    slti(reg.at, r, LIST_END),
    branchTo(beq(reg.at, reg.zero, 0), "exit"),
    NOP,
    ...jumpTo(loop.top),
    mark("exit"),
    ...jumpTo(loop.site + 16),
  ]);
}

/** 分類(`a1`)→表示可否のグループ。追加の分類はバージョン別と同じグループにする */
export function groupWords(): number[] {
  return assemble([
    addiu(reg.at, reg.zero, ADDED_CATEGORY),
    branchTo(bne(reg.a1, reg.at, 0), "original"),
    NOP,
    jr(reg.ra),
    addiu(reg.v0, reg.zero, VERSION_GROUP),
    mark("original"),
    branchTo(bne(reg.a1, reg.zero, 0), "nonzero"),
    NOP,
    j(GROUP_RETURN),
    addiu(reg.v0, reg.zero, 0),
    mark("nonzero"),
    ...jumpTo(GROUP_SITE + 8),
  ]);
}

/**
 * フォルダーの見出しにRANDOMを置くかの判定。
 * `v1`が3のときは原盤の続きへ戻る。
 * それ以外のときは、分類(`s3`)が0x39以下なら`v0`を1にする。追加の分類も1にする
 */
export function randomWords(): number[] {
  return assemble([
    branchTo(bne(reg.v1, reg.v0, 0), "decide"),
    NOP,
    ...jumpTo(RANDOM_SITE + 8),
    mark("decide"),
    addiu(reg.at, reg.zero, ADDED_CATEGORY),
    branchTo(beq(reg.s3, reg.at, 0), "done"),
    addiu(reg.v0, reg.zero, 1),
    slti(reg.v0, reg.s3, RANDOM_BOUND),
    mark("done"),
    ...jumpTo(RANDOM_TAKEN),
  ]);
}

/** セレクトの難易度変更で、分類(`v1`)が0x11未満か追加の分類ならフォルダー全体を替える */
export function selectWords(): number[] {
  return assemble([
    slti(reg.at, reg.v1, VERSION_END),
    branchTo(bne(reg.at, reg.zero, 0), "folder"),
    addiu(reg.at, reg.zero, ADDED_CATEGORY),
    branchTo(bne(reg.v1, reg.at, 0), "rest"),
    NOP,
    mark("folder"),
    ...jumpTo(SELECT_FOLDER),
    mark("rest"),
    ...jumpTo(SELECT_REST),
  ]);
}
