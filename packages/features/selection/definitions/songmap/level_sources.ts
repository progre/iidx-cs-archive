// songmapが、難易度ごとにレベルを読む曲DBの欄。曲DBのレベル欄の並び(`songs/level_charts.ts`)から作る。

import { allLevelChartsOf, chartSlotsOf } from "../songs/mod.ts";
import { elfDefinitionOf } from "../table.ts";
import type { LevelSource } from "./types.ts";

/**
 * レベル欄が無い難易度の読み替え。rankで書く。
 * 例えば beginner の欄が無ければ、normal の欄を読む
 */
const FALLBACK: Readonly<Record<string, string>> = {
  another: "hyper",
  beginner: "normal",
  black: "another",
};

/** songmapがBLACKの枠を持たない世代 */
const WITHOUT_BLACK = new Set(["6th", "7th", "8th"]);

/**
 * 欄があっても読み替える世代。
 * 例えば djt の DP BEGINNER は、DP NORMAL の欄を読む
 */
const DP_FROM_LOWER = { dp_beginner: "dp_normal", dp_black: "dp_another" };
const READ_AS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  djt: DP_FROM_LOWER,
  emp: DP_FROM_LOWER,
  pb: DP_FROM_LOWER,
};

export function levelSourcesOf(
  generation: string,
): Record<string, LevelSource> {
  const fields: readonly (readonly string[])[] = allLevelChartsOf(generation);
  const { selection } = elfDefinitionOf(generation).songDbRecordLayout;
  const hasBeginnerField = selection.beginnerLevelOffset != null;
  const sourceOf = (name: string): LevelSource => {
    const index = fields.findIndex((names) => names.includes(name));
    if (index >= 0) {
      return index;
    }
    const [style, rank] = name.split("_");
    if (rank === "beginner" && hasBeginnerField) {
      return "beginner";
    }
    const fallback = FALLBACK[rank];
    if (fallback === undefined) {
      throw new Error(`${generation}に${name}のレベル欄が無い`);
    }
    return sourceOf(`${style}_${fallback}`);
  };
  const names = chartSlotsOf(generation).filter((name) =>
    !(WITHOUT_BLACK.has(generation) && name.endsWith("_black"))
  );
  return Object.fromEntries(
    names.map((name) => [name, sourceOf(READ_AS[generation]?.[name] ?? name)]),
  );
}
