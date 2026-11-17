/**
 * 5鍵盤版の曲DBエントリーで、表の曲から写す欄。
 * 裏は選曲リストに出ない前提の値を持つので、表示に関わる欄を表から写す。
 * レベルは、裏が譜面を持たない難易度を正にすると選べない譜面が選曲リストに載るので0にする。
 */

import { type EntryFormat, layoutOf, othersOf, versionOf } from "../song_db.ts";

/** OTHERSの印は、下位バイトだけを写す */
const OTHERS_BYTES = 1;

/** 表の曲から写す範囲。5鍵盤版のエントリーは、この範囲だけを表の曲の値に置き換える。`ownLevels`ならレベルは写さない */
export function fiveKeyRangesOf(
  format: EntryFormat,
  ownLevels = false,
): readonly (readonly [number, number])[] {
  const others = othersOf(format).offset;
  const version = versionOf(format);
  const { levels } = layoutOf(format).selection;
  return [
    [others, others + OTHERS_BYTES],
    [version.offset, version.offset + version.bytes],
    ...(ownLevels
      ? []
      : [[levels.offset, levels.offset + levels.count] as const]),
  ];
}

/** `applyFiveKeyFields`が読む範囲だけの最小形。呼び手はSongEntryに限らない。 */
export interface FiveKeyFieldsSource {
  readonly abcReferences: readonly Readonly<{ fieldOffset: number }>[];
  readonly entry: Uint8Array;
}

/**
 * 5鍵盤版のエントリーを、ゲームへ載る姿にして返す。
 * 合成した世代のエントリーは譜面欄が仮値で有無を判別できないため、資産の参照欄で見る。
 */
export function applyFiveKeyFields(
  format: EntryFormat,
  song: FiveKeyFieldsSource,
  frontEntry: Uint8Array,
  ownLevels = false,
): Uint8Array {
  const out = song.entry.slice();
  const [others, version, levels] = fiveKeyRangesOf(format);
  for (const [start, end] of [others, version]) {
    out.set(frontEntry.subarray(start, end), start);
  }
  // 全曲リストで書いた組の5鍵盤版は、独立した曲として自分のレベルを持つ
  if (ownLevels) {
    return out;
  }
  out.fill(0, levels[0], levels[1]);
  const charted = new Set(
    song.abcReferences.map((reference) => reference.fieldOffset),
  );
  const { files } = layoutOf(format).chart;
  for (let slot = 0; slot < files.count; slot++) {
    const field = format.chartSlotFieldOffset(slot);
    if (!charted.has(field)) {
      continue;
    }
    const at = format.levelFieldOffset(
      format.difficultyNameOfChartField(field),
    );
    out[at] = frontEntry[at];
  }
  return out;
}
