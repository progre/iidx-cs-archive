// 曲DBのレベル欄の並び。欄の位置は定義表(`selection.levels`)が持つ。

import type { DifficultyName } from "./chart_slots.ts";

type Levels = readonly (readonly DifficultyName[])[];

/** 3rdと4thは、SPとDPが同じ値を持つ */
const SHARED_HYPER_NORMAL: Levels = [
  ["sp_hyper", "dp_hyper"],
  ["sp_normal", "dp_normal"],
];

/** 5th〜8thの初心者の2つの欄は、位置が未確認である(`UNCONFIRMED`) */
const SP_DP_PAIRS: Levels = [
  ["sp_hyper"],
  ["dp_hyper"],
  ["sp_normal"],
  ["dp_normal"],
  ["sp_beginner"],
  ["dp_beginner"],
];

const HYPER_NORMAL_PAIRS: Levels = [
  ["sp_hyper"],
  ["sp_normal"],
  ["dp_hyper"],
  ["dp_normal"],
];

const NORMAL_HYPER_ANOTHER: Levels = [
  ["sp_normal"],
  ["sp_hyper"],
  ["sp_another"],
  ["dp_normal"],
  ["dp_hyper"],
  ["dp_another"],
];

/** SPとDPの5譜面ずつを、BEGINNERとBLACKを含めて持つ */
const TEN_LEVELS: Levels = [
  ["sp_normal"],
  ["sp_hyper"],
  ["sp_another"],
  ["sp_beginner"],
  ["sp_black"],
  ["dp_normal"],
  ["dp_hyper"],
  ["dp_another"],
  ["dp_beginner"],
  ["dp_black"],
];

/**
 * レベル欄のバイトごとに、その値を持つ難易度を並べる。
 * 3rd〜10thにはANOTHERの欄が無いので、SP ANOTHERとDP ANOTHERは読めない。
 */
const BY_GENERATION: Readonly<Record<string, Levels>> = {
  "3rd": SHARED_HYPER_NORMAL,
  "4th": SHARED_HYPER_NORMAL,
  "5th": SP_DP_PAIRS,
  "6th": SP_DP_PAIRS,
  "7th": SP_DP_PAIRS,
  "8th": SP_DP_PAIRS,
  "9th": HYPER_NORMAL_PAIRS,
  "10th": HYPER_NORMAL_PAIRS,
  us: [
    ["sp_normal"],
    ["sp_hyper"],
    ["sp_another"],
    ["sp_beginner"],
    ["dp_normal"],
    ["dp_hyper"],
    ["dp_another"],
    ["dp_beginner"],
  ],
  red: [
    ["sp_hyper"],
    ["sp_normal"],
    ["sp_another"],
    ["dp_hyper"],
    ["dp_normal"],
    ["dp_another"],
  ],
  hs: NORMAL_HYPER_ANOTHER,
  dd: NORMAL_HYPER_ANOTHER,
  gold: NORMAL_HYPER_ANOTHER,
  djt: TEN_LEVELS,
  emp: TEN_LEVELS,
  pb: TEN_LEVELS,
};

/** 位置が未確認の欄。songmapは読むが、全曲リストとの照合には使わない */
const UNCONFIRMED: Readonly<Record<string, readonly number[]>> = {
  "5th": [4, 5],
  "6th": [4, 5],
  "7th": [4, 5],
  "8th": [4, 5],
};

/** 世代のレベル欄の並び。未確認の欄も含む。表に無い世代は空 */
export const allLevelChartsOf = (generation: string): Levels =>
  BY_GENERATION[generation] ?? [];

/** 世代のレベル欄の並び。未確認の欄は空にする。表に無い世代は空 */
export const levelChartsOf = (generation: string): Levels =>
  allLevelChartsOf(generation).map((names, index) =>
    UNCONFIRMED[generation]?.includes(index) ? [] : names
  );
