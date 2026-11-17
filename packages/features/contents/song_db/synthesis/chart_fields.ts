// 譜面の統計量から決まる欄(BPMとノーツ数)を曲DBエントリへ書く。

import type { ChartStats } from "@csa/core";
import type { SongDbRecord } from "../record/mod.ts";
import { difficultyOf } from "../pb/format/mod.ts";

const NO_BPM_RANGE = 0xffff;

/** 譜面ごとの統計量からBPM欄とノーツ数欄を書く。PB全99曲で一致 */
export function writeChartFields(
  record: SongDbRecord,
  charts: ReadonlyMap<string, ChartStats>,
): void {
  const notes = record.chart.notes ?? [];
  let min = Number.POSITIVE_INFINITY;
  let max = -1;
  let first = -1;
  for (const [name, stats] of charts) {
    const difficulty = difficultyOf(name);
    const counts = difficulty.style === "sp"
      ? [stats.total]
      : [stats.p1, stats.p2];
    difficulty.notesIndices.forEach((index, i) => {
      notes[index] = counts[i];
    });
    if (stats.bpmMin < 0) continue;
    if (first < 0) first = stats.bpmFirst;
    min = Math.min(min, stats.bpmMin);
    max = Math.max(max, stats.bpmMax);
  }
  if (max < 0) {
    throw new Error("譜面にBPMイベントが無い");
  }
  record.chart.notes = notes;
  // BPMが変化する曲だけ、範囲を書く。3つ目の欄は先頭BPMとみなして書く
  // (暫定)
  record.selection.bpm = {
    first: min === max ? NO_BPM_RANGE : first,
    max: min === max ? NO_BPM_RANGE : max,
    min,
  };
}
