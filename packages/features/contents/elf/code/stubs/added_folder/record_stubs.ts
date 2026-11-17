// 追加フォルダーのレコードを、原盤のバージョン別フォルダーのコードで引かせるスタブ。
// 本体はレコード`1 + 5×枠 + 側`を読み書きするので、分類や作品番号を枠kへ差し替える。

import {
  addiu,
  addu,
  assemble,
  bne,
  branchTo,
  isControl,
  j,
  jal,
  jr,
  ld,
  lui,
  mark,
  NOP,
  ori,
  reg,
  sb,
  sd,
  slti,
  sw,
} from "../../mips/mod.ts";
import {
  ADDED_CATEGORY,
  FIRST_ADDED_VERSION,
  INIT_FUNCTION,
  VERSION_FUNCTION,
} from "./sites.ts";

const FOLDER_RECORDS = 5;
const RECORD_COUNT = 4;
const RECORD_AGGREGATE = 8;
/** 原盤の初期化がレコードの集約状態へ書く値 */
const AGGREGATE_INITIAL = 0x7f;

/** 預かる元の語。分岐や飛び先を持つ語はスタブへ移せない */
function carried(word: number, address: number): number {
  if (isControl(word)) {
    throw new Error(`0x${address.toString(16)}の分岐をスタブへ移せない`);
  }
  return word;
}

/** 32bitの値を`rt`へ作る。負の値は符号拡張された形になる */
const load32 = (rt: number, value: number) => [
  lui(rt, (value >>> 16) & 0xffff),
  ori(rt, rt, value & 0xffff),
];

/**
 * 関数の入口。預かった先頭2語を実行し、分類(`a1`)が追加の分類なら`wrapped`へ
 * 置き換えて3語目へ戻る。`wordAt`は差し替える前の語を返す
 */
export function entryWords(
  entry: number,
  wrapped: number,
  wordAt: (address: number) => number,
): number[] {
  return assemble([
    carried(wordAt(entry), entry),
    carried(wordAt(entry + 4), entry + 4),
    addiu(reg.at, reg.zero, ADDED_CATEGORY),
    branchTo(bne(reg.a1, reg.at, 0), "continue"),
    NOP,
    ...load32(reg.a1, wrapped),
    mark("continue"),
    j(entry + 8),
    NOP,
  ]);
}

/** 作品番号を得る関数を呼び、追加フォルダーへ入れる作品番号なら`枠k - 1`を返す */
export function versionWords(slot: number): number[] {
  return assemble([
    addiu(reg.sp, reg.sp, -16),
    sd(reg.ra, 0, reg.sp),
    jal(VERSION_FUNCTION),
    NOP,
    ld(reg.ra, 0, reg.sp),
    addiu(reg.sp, reg.sp, 16),
    slti(reg.at, reg.v0, FIRST_ADDED_VERSION),
    branchTo(bne(reg.at, reg.zero, 0), "keep"),
    NOP,
    addiu(reg.v0, reg.zero, slot - 1),
    mark("keep"),
    jr(reg.ra),
    NOP,
  ]);
}

/**
 * 原盤の全レコード初期化を呼んだあと、追加フォルダーの5本を初期化する。
 * 呼び手の選曲ワーク作成処理は`s0`にワーク先頭を持つ
 */
export function initWords(start: number, recordSize: number): number[] {
  if (recordSize > 0x7fff) {
    throw new Error("レコード長が即値に収まらない");
  }
  return assemble([
    addiu(reg.sp, reg.sp, -16),
    sd(reg.ra, 0, reg.sp),
    jal(INIT_FUNCTION),
    NOP,
    ld(reg.ra, 0, reg.sp),
    addiu(reg.sp, reg.sp, 16),
    ...load32(reg.t0, start),
    addu(reg.t0, reg.s0, reg.t0),
    addiu(reg.t2, reg.zero, AGGREGATE_INITIAL),
    addiu(reg.t3, reg.zero, FOLDER_RECORDS),
    mark("record"),
    sb(reg.zero, 0, reg.t0),
    sw(reg.zero, RECORD_COUNT, reg.t0),
    sb(reg.t2, RECORD_AGGREGATE, reg.t0),
    addiu(reg.t3, reg.t3, -1),
    branchTo(bne(reg.t3, reg.zero, 0), "record"),
    addiu(reg.t0, reg.t0, recordSize),
    jr(reg.ra),
    NOP,
  ]);
}
