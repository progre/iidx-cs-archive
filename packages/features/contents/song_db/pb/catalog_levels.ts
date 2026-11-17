// 全曲リストの難易度を、曲DBエントリのレベル欄へ書く。
// 書いていない譜面は、エントリの値(原作の値)のままにする。

import type { SongDbRecord } from "../record/mod.ts";
import { difficultyOf, type PbEntryFormat } from "./format/mod.ts";

export type DifficultyLevel = readonly [name: string, level: number];

/** `skipMissing`は、5鍵盤版で、表のエントリーの値を裏のエントリーへ写すときに指定する。 */
export function writeDifficultyLevels(
  record: SongDbRecord,
  levels: readonly DifficultyLevel[],
  skipMissing = false,
): void {
  const notes = record.chart.notes ?? [];
  const values = record.selection.levels;
  for (const [name, level] of levels) {
    const difficulty = difficultyOf(name);
    // 合成の途中の譜面欄は仮の0なので、譜面の有無はノーツ数で決める
    const hasChart = difficulty.notesIndices.some((i) => (notes[i] ?? 0) > 0);
    if (!hasChart) {
      if (skipMissing) {
        continue;
      }
      throw new Error(`曲に無い譜面へ難易度を書いている: ${name}=${level}`);
    }
    values[difficulty.levelIndex] = level;
  }
  record.selection.levels = values;
}

/** CSA に入れる SP BEGINNER のレベルの上限 */
export const SP_BEGINNER_LEVEL_LIMIT = 3;

/** SP BEGINNER のレベルを、上限を超えていれば上限にする */
export function limitBeginnerLevel(record: SongDbRecord): void {
  const index = difficultyOf("sp_beginner").levelIndex;
  const levels = record.selection.levels;
  levels[index] = Math.min(levels[index], SP_BEGINNER_LEVEL_LIMIT);
  record.selection.levels = levels;
}

/** エントリーの写しに難易度を書き、書いた後のレベル欄を返す。曲に無い譜面へ書いていれば止める */
export function levelFieldsWith(
  format: PbEntryFormat,
  entry: Uint8Array,
  levels: readonly DifficultyLevel[],
): Uint8Array {
  const record = format.recordOf(entry.slice());
  writeDifficultyLevels(record, levels);
  return Uint8Array.from(record.selection.levels);
}
