// Statistics画面の集計(`FUN_0015f530`)が、譜面数の分母へ足す値を決める。

/** 分母を持つ区分。集計の区分の並びの順である */
export const CATEGORIES = [
  "sp_normal",
  "sp_hyper",
  "sp_another",
  "sp_black",
  "dp_normal",
  "dp_hyper",
  "dp_another",
  "dp_black",
] as const;

export type Category = typeof CATEGORIES[number];

/** ループが曲DBを見ずに、全曲を1つずつ数える区分。PBの曲はどれもNORMALとHYPERを持つ */
const COUNTED_FOR_EVERY_SONG: ReadonlySet<Category> = new Set([
  "sp_normal",
  "sp_hyper",
  "dp_normal",
  "dp_hyper",
]);

/** 曲DBの1曲。`levels`に無い区分のレベルは0とみなす */
export interface StatisticsSong {
  levels: Partial<Record<Category, number>>;
  /** スコアを保存する曲なら真 */
  saved: boolean;
}

const INT16_MIN = -0x8000;
const INT16_MAX = 0x7fff;

/**
 * ループが数えた数に足して、スコアを保存する譜面の数にする値。
 * ループは、曲DBの全曲を見る。ANOTHERとBLACKは、レベルが0より大きい曲だけを数える
 */
export function totalAdjustments(
  songs: readonly StatisticsSong[],
): Record<Category, number> {
  const has = (song: StatisticsSong, category: Category) =>
    (song.levels[category] ?? 0) > 0;
  return Object.fromEntries(CATEGORIES.map((category) => {
    const wanted = songs.filter((song) =>
      song.saved && has(song, category)
    ).length;
    const counted = COUNTED_FOR_EVERY_SONG.has(category)
      ? songs.length
      : songs.filter((song) => has(song, category)).length;
    const add = wanted - counted;
    if (add < INT16_MIN || add > INT16_MAX) {
      throw new Error(`${category}の分母に足す値が16bitに収まらない: ${add}`);
    }
    return [category, add];
  })) as Record<Category, number>;
}
