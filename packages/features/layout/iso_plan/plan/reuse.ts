// どの曲も指さなくなった原盤の領域へ新規資産を置く。
// manifestの順に、空いた領域で最初に収まるところへ置き、どこにも収まらなければ原盤の終端へ連ねる。

import type { PlacementPlan, PlannedRange } from "../types.ts";

export function allocator(
  reusableRanges: readonly PlannedRange[],
  sourceVolumeSectors: number,
) {
  const free = reusableRanges.map((range) => {
    if (range.startLba >= range.endLba || range.endLba > sourceVolumeSectors) {
      throw new Error(
        `原盤の空いた領域が原盤の外にある: ${range.startLba}..${range.endLba}`,
      );
    }
    return { ...range };
  });
  let cursor = sourceVolumeSectors;
  return {
    allocate(size: number): number {
      const range = free.find(({ endLba, startLba }) =>
        endLba - startLba >= size
      );
      const lba = range?.startLba ?? cursor;
      if (range === undefined) {
        cursor += size;
      } else {
        range.startLba += size;
      }
      return lba;
    },
    /** 原盤の終端へ連ねた範囲の末尾 */
    end: () => cursor,
  };
}

/** 空いた領域ごとに、置いた件数とセクター数を1行で書く */
export const describeReuse = (plan: PlacementPlan): string[] =>
  plan.reusedRanges.map((range) => {
    const reused = plan.placements.filter(({ lba }) =>
      range.startLba <= lba && lba < range.endLba
    );
    const sectors = reused.reduce((sum, placed) => sum + placed.sectors, 0);
    return `freed source range ${range.startLba}..${range.endLba}: ` +
      `${reused.length} (${sectors} sectors)`;
  });
