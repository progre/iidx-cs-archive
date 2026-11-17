/**
 * 1つのbyte access命令を、上位byte配列を併せて読む・書く命令列に広げる。
 *
 * 読出しは下位と上位を合成して元の宛先へ入れ、書込みは値の下位と上位を2か所へ書く。
 * 一時registerは`sp`の下へ退避して使う。gcc生成コードは`sp`より下を触らず、
 * EEカーネルは例外contextをカーネル側へ保存するので、この2語は誰にも壊されない。
 */

import {
  addiu,
  decodeFields,
  lbu,
  ld,
  or,
  reg,
  sb,
  sd,
  sll,
  srl,
} from "../../mips/mod.ts";

export const OP_LB = 0x20, OP_LBU = 0x24, OP_SB = 0x28;
export const SPILL_FIRST = -8, SPILL_SECOND = -16;

export const fits16 = (value: number) => value >= -0x8000 && value <= 0x7fff;

/** `excluded`に無い一時registerを`at`、`v0`、`v1`、`t8`、`t9`の順で選ぶ。 */
export function pickTemporaries(
  excluded: readonly number[],
  count: number,
): number[] {
  const picked: number[] = [];
  for (const candidate of [reg.at, reg.v0, reg.v1, reg.t8, reg.t9]) {
    if (excluded.includes(candidate)) continue;
    picked.push(candidate);
    if (picked.length === count) return picked;
  }
  throw new Error("一時registerを確保できない");
}

export type Widened = Readonly<{
  kind: "load" | "store";
  words: readonly number[];
}>;

/**
 * `word`は差し替え前の命令語。下位配列は`imm+lowDelta`、上位配列は`imm+highDelta`に
 * ある。`rs`が`sp`のsiteは退避先と衝突するので受け付けない。
 */
export function widen(
  word: number,
  lowDelta: number,
  highDelta: number,
): Widened {
  const { op, rs, rt, imm } = decodeFields(word);
  if (rs === reg.sp) throw new Error("spを基底にするsiteは広げられない");
  const low = imm + lowDelta, high = imm + highDelta;
  if (!fits16(low)) throw new Error("下位配列が16bit即値に収まらない");
  if (op === OP_LB || op === OP_LBU) {
    const [temp] = pickTemporaries([rs, rt], 1);
    const words = fits16(high)
      ? [
        sd(temp, SPILL_FIRST, reg.sp),
        lbu(temp, high, rs),
        lbu(rt, low, rs),
        sll(temp, temp, 8),
        or(rt, rt, temp),
        ld(temp, SPILL_FIRST, reg.sp),
      ]
      : [
        sd(temp, SPILL_FIRST, reg.sp),
        addiu(temp, rs, highDelta),
        lbu(temp, imm, temp),
        lbu(rt, low, rs),
        sll(temp, temp, 8),
        or(rt, rt, temp),
        ld(temp, SPILL_FIRST, reg.sp),
      ];
    return { kind: "load", words };
  }
  if (op === OP_SB) {
    if (fits16(high)) {
      const [temp] = pickTemporaries([rs, rt], 1);
      return {
        kind: "store",
        words: [
          sd(temp, SPILL_FIRST, reg.sp),
          srl(temp, rt, 8),
          sb(temp, high, rs),
          sb(rt, low, rs),
          ld(temp, SPILL_FIRST, reg.sp),
        ],
      };
    }
    const [value, address] = pickTemporaries([rs, rt], 2);
    return {
      kind: "store",
      words: [
        sd(value, SPILL_FIRST, reg.sp),
        sd(address, SPILL_SECOND, reg.sp),
        addiu(address, rs, highDelta),
        srl(value, rt, 8),
        sb(value, imm, address),
        sb(rt, low, rs),
        ld(address, SPILL_SECOND, reg.sp),
        ld(value, SPILL_FIRST, reg.sp),
      ],
    };
  }
  throw new Error("lb/lbu/sb以外の命令は広げられない: 0x" + word.toString(16));
}
