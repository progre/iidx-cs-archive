// 5鍵盤版stubの足場。フレームの割り当て、原作の判定関数、4つのstubで展開する小片。
// 検証用エミュレーターがstub内の`jal`を追えないので、共有する処理は関数にせず展開する。

import {
  addiu,
  addu,
  always,
  beq,
  bltz,
  branchTo,
  jal,
  jr,
  lw,
  mark,
  NOP,
  pairWords,
  type Piece,
  reg,
  sw,
} from "../../mips/mod.ts";
import { fieldOffset, type ROW_FIELDS, ROW_SIZE, TWIN_TABLE } from "./table.ts";

export const FRAME = 0x30;

/** フレームに置く値。jalをまたぐとt/aレジスタは壊れるので、ここへ退避する */
export const SLOT = {
  ra: 0x20,
  song: 0x14,
  state: 0x18,
  value: 0x1c,
} as const;

/** 1を返す出口、0を返す出口、両者が合流する終端 */
export const ONE = "one";
export const ZERO = "zero";
export const DONE = "done";

/** 原作の判定関数 */
export const PB = {
  /** 選曲ワークを作り直す */
  buildWork: 0x20d9c0,
  /** シングルで使っている側 */
  currentSide: 0x1d5be0,
  /** DPか */
  doubleMode: 0x1d5690,
  /** 側の5KEYS設定が非0か */
  fiveKeys: 0x1d53a0,
  /** 側の5KEYS設定(オプション`+0x20`)が`a1`の値か */
  fiveKeysIs: 0x1d50b0,
  /** 演奏準備で写した側の5KEYS(演奏側構造体`+0x18`)が1か2か */
  playFiveKeys: 0x201be0,
  songIndex: 0x2021b0,
  /** 曲indexが窓の内側か */
  songWindow: 0x1dd820,
} as const;

export const enter = (): Piece[] => [
  addiu(reg.sp, reg.sp, -FRAME),
  sw(reg.ra, SLOT.ra, reg.sp),
];

export const leave = (): Piece[] => [
  lw(reg.ra, SLOT.ra, reg.sp),
  addiu(reg.sp, reg.sp, FRAME),
  jr(reg.ra),
  NOP,
];

/** `one`と`zero`の出口を置き、どちらも`done`へ合流する */
export const flags = (): Piece[] => [
  mark(ONE),
  addiu(reg.v0, reg.zero, 1),
  ...always(DONE),
  mark(ZERO),
  addiu(reg.v0, reg.zero, 0),
  mark(DONE),
];

/**
 * 「使う側が5KEYSか」を`SLOT.state`へ0/1で置く。DPは両側が5KEYSのときだけ1になる。
 * 原盤の記録可否の判定と同じ求め方。
 */
export function stateValue(): Piece[] {
  const single = "stateSingle";
  const set = "stateSet";
  const done = "stateDone";
  return [
    sw(reg.zero, SLOT.state, reg.sp),
    jal(PB.doubleMode),
    NOP,
    branchTo(beq(reg.v0, reg.zero, 0), single),
    NOP,
    ...[0, 1].flatMap((side) => [
      addiu(reg.a0, reg.zero, side),
      jal(PB.fiveKeys),
      NOP,
      branchTo(beq(reg.v0, reg.zero, 0), done),
      NOP,
    ]),
    ...always(set),
    mark(single),
    jal(PB.currentSide),
    NOP,
    jal(PB.fiveKeys),
    addu(reg.a0, reg.v0, reg.zero),
    branchTo(beq(reg.v0, reg.zero, 0), done),
    NOP,
    mark(set),
    addiu(reg.t0, reg.zero, 1),
    sw(reg.t0, SLOT.state, reg.sp),
    mark(done),
  ];
}

/**
 * 対の表で`match`の列が`t2`と一致する行を探し、その`take`の列を`v0`へ置く。
 * 無ければ`v0`は`-1`になる。`t0`・`t1`・`t3`を壊す。
 */
export function lookup(
  prefix: string,
  match: typeof ROW_FIELDS[number],
  take: typeof ROW_FIELDS[number],
): Piece[] {
  const scan = prefix + "Scan";
  const hit = prefix + "Hit";
  const done = prefix + "Done";
  return [
    ...pairWords(reg.t0, TWIN_TABLE),
    addiu(reg.v0, reg.zero, -1),
    mark(scan),
    lw(reg.t1, fieldOffset("front"), reg.t0),
    branchTo(bltz(reg.t1, 0), done),
    NOP,
    lw(reg.t3, fieldOffset(match), reg.t0),
    branchTo(beq(reg.t3, reg.t2, 0), hit),
    NOP,
    addiu(reg.t0, reg.t0, ROW_SIZE),
    ...always(scan),
    mark(hit),
    lw(reg.v0, fieldOffset(take), reg.t0),
    mark(done),
  ];
}
