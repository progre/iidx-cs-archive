// 5鍵盤版の表裏対応。演奏中BGM差し替えの組は、全曲リストの裏の曲の行に書く。

/**
 * 5鍵盤版の曲の組。裏のsong_id → 同じ世代の表のsong_id。
 * 曲DBに表裏を区別する欄が無く、原作も対をELFのコードに直書きしているので、
 * ここに世代とsong_idで持つ。
 */
const FIVE_KEY_TWINS: Record<string, Record<number, number>> = {
  "dd": { 97: 79, 98: 80, 99: 81, 100: 82, 101: 83, 102: 84 },
  "gold": {
    97: 76,
    98: 77,
    99: 78,
    100: 79,
    101: 80,
    102: 81,
    103: 82,
    104: 83,
    105: 84,
  },
  // song100の表の曲は別の世代にある。そのため、ここには書かず、全曲リストに表の曲を書く
  "djt": { 97: 74, 98: 73, 99: 75, 101: 76, 102: 77 },
};

/** 5鍵盤版なら同じ世代の表のsong_id。無ければ`undefined` */
export const fiveKeyOf = (
  generation: string,
  songId: number,
): number | undefined => FIVE_KEY_TWINS[generation]?.[songId];

// 曲DBの譜面の欄の並び。キー音とBGMの組も、同じ並びで持つ。

type Style = "sp" | "dp";
type Rank = "normal" | "hyper" | "another" | "beginner" | "black";
export type DifficultyName = `${Style}_${Rank}`;

/** SPとDPが交互で、HYPER・ANOTHER・NORMAL・BEGINNER・BLACKの順(PB実測) */
const STANDARD: readonly DifficultyName[] = [
  "sp_hyper",
  "dp_hyper",
  "sp_another",
  "dp_another",
  "sp_normal",
  "dp_normal",
  "sp_beginner",
  "dp_beginner",
  "sp_black",
  "dp_black",
];

/**
 * usはNORMAL・HYPER・ANOTHER・BEGINNERの順で、HYPERとNORMALが入れ替わる。
 * この順は、同じ譜面を持つ5thの曲とノーツ数を比べて決めた。
 */
const BY_GENERATION: Readonly<Record<string, readonly DifficultyName[]>> = {
  us: [
    "sp_normal",
    "dp_normal",
    "sp_hyper",
    "dp_hyper",
    "sp_another",
    "dp_another",
    "sp_beginner",
    "dp_beginner",
  ],
};

export const chartSlotsOf = (generation: string): readonly DifficultyName[] =>
  BY_GENERATION[generation] ?? STANDARD;
