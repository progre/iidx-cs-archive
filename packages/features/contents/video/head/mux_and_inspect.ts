// 再エンコードしたESを、PSSにして検査する。I/Oは行わない。
// 検査の基準は、呼び出し側が`findProblems`で渡す。

import { muxPss } from "../mux_pss.ts";
import {
  countPictures,
  extractVideoEs,
  summarizePss,
} from "../pss_structure.ts";

/** 検査の基準が読む、PSSの事実 */
export interface PssFactsInput {
  height: number;
  packSizes: number[];
  pictures: number;
  sourcePictures: number;
  systemHeaders: number;
  trailing: number;
  width: number;
}

/** `es`は再エンコード後のES、`source`は変換前のPSS */
export function muxAndInspect<Problems>(
  es: Uint8Array,
  source: Uint8Array,
  findProblems: (facts: PssFactsInput) => Problems,
): {
  pictures: number;
  problems: Problems;
  pss: Uint8Array;
} {
  const pss = muxPss(es);
  const summary = summarizePss(pss);
  const pictures = countPictures(es);
  const problems = findProblems({
    height: summary.height,
    packSizes: [...summary.packs.keys()],
    pictures,
    sourcePictures: countPictures(extractVideoEs(source)),
    systemHeaders: summary.systemHeaders,
    trailing: summary.trailing,
    width: summary.width,
  });
  return { pictures, problems, pss };
}
