// 曲リストの難易度の列の並びと見出しの略号。

import type { Difficulty } from "../types.ts";

/**
 * 列の並びと見出しの略号。曲DBの譜面スロット順は欄offsetの算出に使う値なので、
 * 読む順はここで別に決める。
 * DP BEGINNERの枠は譜面が存在せず用途も分からないので、略号を`??`にする。
 */
const DISPLAY_COLUMNS: readonly (readonly [string, string])[] = [
  ["sp_beginner", "SB"],
  ["sp_normal", "SN"],
  ["sp_hyper", "SH"],
  ["sp_another", "SA"],
  ["sp_black", "SX"],
  ["dp_beginner", "??"],
  ["dp_normal", "DN"],
  ["dp_hyper", "DH"],
  ["dp_another", "DA"],
  ["dp_black", "DX"],
];

export const DIFFICULTY_NAMES: readonly string[] = DISPLAY_COLUMNS.map((
  [name],
) => name);

/** 見出しの譜面スロット番号は、PBの曲DBの譜面の並びの何番目かである */
export const difficultiesOf = (chartSlots: readonly string[]): Difficulty[] =>
  DISPLAY_COLUMNS.map(([name, label]) => {
    const slot = chartSlots.findIndex((each) => each === name);
    if (slot < 0) {
      throw new Error(`譜面の並びに無い難易度: ${name}`);
    }
    return { label, name, slot };
  });
