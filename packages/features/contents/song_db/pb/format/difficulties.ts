// PB形式の曲DBエントリの難易度。欄の位置は持たない。
// 持つのは、各難易度がレベル・ノーツ数の並びの何番目にあるかだけである。
// 譜面の並びは世代の定義が持ち、`PbEntryFormat`が受け取る。

export type Style = "sp" | "dp";
/** レベルの並び`style*5 + rank`のrank順 */
const RANKS = ["normal", "hyper", "another", "beginner", "black"] as const;
type Rank = (typeof RANKS)[number];
export type DifficultyName = `${Style}_${Rank}`;

export interface Difficulty {
  /** レベルの並びの何番目か */
  levelIndex: number;
  name: DifficultyName;
  /** ノーツ数の並びの何番目か。SPは総数の1つ、DPは1Pと2Pの2つ */
  notesIndices: number[];
  style: Style;
}

/**
 * ノーツ数の並びの先頭には、SPの総数がrank順に5つある。
 * その後に、DPの1Pと2Pの組がrank順に5組続く。
 */
const SP_NOTES = RANKS.length;

export function difficultyOf(name: string): Difficulty {
  const [style, rank] = name.split("_");
  const rankIndex = RANKS.indexOf(rank as Rank);
  if ((style !== "sp" && style !== "dp") || rankIndex < 0) {
    throw new Error(`未知の難易度名: ${name}`);
  }
  return {
    levelIndex: (style === "sp" ? 0 : 1) * RANKS.length + rankIndex,
    name: name as DifficultyName,
    notesIndices: style === "sp" ? [rankIndex] : [
      SP_NOTES + rankIndex * 2,
      SP_NOTES + rankIndex * 2 + 1,
    ],
    style,
  };
}

/**
 * 音の並びは、譜面の並びのpごとに(keysound, bgm)の組を持つ。
 * 組の並びは [0,2],[1,3],[4,6],[5,7],… で、keysoundの2つ後がbgm(PB実測)。
 */
export const keysoundSlotOf = (chartSlot: number): number =>
  (chartSlot >> 1) * 4 + (chartSlot & 1);

export const bgmSlotOf = (chartSlot: number): number =>
  keysoundSlotOf(chartSlot) + 2;
