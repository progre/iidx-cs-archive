// 全曲リストに書いた難易度のうち、書いても効かないものを見つける。
// 原作と同じ値は書かなくてよく、曲に無い譜面への値は使われない。

import type { CatalogMatch } from "../../match.ts";
import { type CatalogRow, type Chart, CHARTS } from "../../file/mod.ts";

/** 曲DBから読んだ、1曲の原作の難易度と、譜面がある難易度 */
export interface SongOriginal {
  levels: Partial<Record<Chart, number>>;
  charts: Chart[];
}

export type LevelReport =
  /** 原作と同じ値を書いた譜面 */
  | { kind: "sameLevel"; row: CatalogRow; charts: Chart[] }
  /** 曲に無い譜面へ値を書いた譜面 */
  | { kind: "noChart"; row: CatalogRow; charts: Chart[] };

/** `originals`は曲DBのindexから引く。無い曲は調べない */
export function auditLevels(
  matches: CatalogMatch[],
  originals: Map<number, SongOriginal>,
): LevelReport[] {
  return matches.flatMap(({ row, song }) => {
    const original = originals.get(song.songId);
    if (original == null) {
      return [];
    }
    const written = CHARTS.filter((chart) => row.levels[chart] != null);
    const same = written.filter((chart) =>
      original.levels[chart] === row.levels[chart]
    );
    const noChart = written.filter((chart) => !original.charts.includes(chart));
    return [
      ...(same.length > 0
        ? [{ kind: "sameLevel", row, charts: same } as const]
        : []),
      ...(noChart.length > 0
        ? [{ kind: "noChart", row, charts: noChart } as const]
        : []),
    ];
  });
}
