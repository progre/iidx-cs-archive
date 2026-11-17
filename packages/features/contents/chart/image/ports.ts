// 譜面のbundleを組む処理が使う、他の feature の関数。実装は app が渡す。

import type { Era1GenerationCharts } from "../compat/mod.ts";
import type { LzPlace } from "../lz_store/mod.ts";

export interface PackedChartPorts {
  /** era1の世代なら譜面を変換する。era1でなければ`undefined`を返す */
  convertEra1(generation: string): Era1GenerationCharts | undefined;
  /** 周回で書いた世代のLZファイルの場所 */
  lzOf(generation: string): LzPlace;
  /** 世代のbundleに入れる譜面のsource file index */
  sourceFileIndicesOf(generation: string): Iterable<number>;
}
