// キー音バンクとBGMの形式。contents/sound の判定結果と、
// selection/definitions の世代表の両方から参照されるためcoreに置く。

export type KeysoundForm = "headerless" | "ef1" | "wp2" | "wp3";
export type BgmForm = "bigendian" | "vig";

export type ChartFormat = "F1" | "F2" | "F3";

export interface ChartStats {
  /** c2==0 のノートだけを数えた値(曲DBのノーツ数欄と一致する)。 */
  p1: number;
  p2: number;
  total: number;
  /** c2 の値を問わず数えた値。 */
  p1All: number;
  p2All: number;
  totalAll: number;
  bpmFirst: number;
  bpmMin: number;
  bpmMax: number;
  bgmTick: number;
  firstNoteTick: number;
  lastTick: number;
}
