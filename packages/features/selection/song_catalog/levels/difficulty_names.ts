// 全曲リストの譜面の列名と、曲DBの難易度名(`sp_normal`など)の対応。

import { type Chart, CHARTS } from "../file/mod.ts";

// 曲DBのレベル欄のバイトを、譜面ごとの原作の難易度に直す。
// 欄ごとの難易度の並びは、呼び出し元が世代の定義から渡す。
export interface RawLevels {
  /** `selection.levels`のバイト */
  levels: number[];
  /** `selection.beginnerLevelOffset`のバイト。欄が無ければnull */
  beginnerLevel: number | null;
}

/**
 * `levelCharts`は、レベル欄のバイトごとに、その値を持つ難易度を`sp_hyper`の形で並べる。
 * 値が0の欄は、譜面が無いか未設定なので、持たない
 */
export function originalLevelsOf(
  levelCharts: readonly (readonly string[])[],
  raw: RawLevels,
): Partial<Record<Chart, number>> {
  const fromBytes = levelCharts.flatMap((names, index) => {
    const level = raw.levels.at(index) ?? 0;
    return level > 0
      ? names.map((name) => [chartOfName(name), level] as const)
      : [];
  });
  const beginner = raw.beginnerLevel != null && raw.beginnerLevel > 0
    ? [["sb", raw.beginnerLevel] as const]
    : [];
  return Object.fromEntries([...fromBytes, ...beginner]);
}

// 曲DBの譜面スロットから、譜面がある難易度を判定する。スロットの並びは呼び出し元が渡す。
const NO_CHART_VALUES = [0, 0xffffffff];

/** 曲DBの譜面スロットの値から、譜面がある難易度を返す。0と0xffffffffは譜面が無い */
export function existingChartsOf(
  chartSlots: readonly string[],
  files: readonly number[],
): Chart[] {
  return files.flatMap((value, slot) => {
    const name = chartSlots.at(slot);
    return name == null || NO_CHART_VALUES.includes(value)
      ? []
      : [chartOfName(name)];
  });
}

const DIFFICULTY_NAME: Record<Chart, string> = {
  sb: "sp_beginner",
  sn: "sp_normal",
  sh: "sp_hyper",
  sa: "sp_another",
  sl: "sp_black",
  db: "dp_beginner",
  dn: "dp_normal",
  dh: "dp_hyper",
  da: "dp_another",
  dl: "dp_black",
};

/** 全曲リストの難易度。譜面の列名から値を引く */
export type CatalogLevels = Partial<Record<Chart, number>>;

/** 値がある譜面を、列の並びのまま難易度名とレベルの組にする */
export function levelsByDifficulty(
  levels: CatalogLevels,
): [name: string, level: number][] {
  return CHARTS.flatMap((chart) => {
    const level = levels[chart];
    return level == null ? [] : [[DIFFICULTY_NAME[chart], level]];
  });
}

/** 譜面の列名を、曲DBの難易度名にする */
export const difficultyNamesOf = (charts: readonly Chart[]): string[] =>
  charts.map((chart) => DIFFICULTY_NAME[chart]);

/** 曲DBの難易度名を、譜面の列名にする */
export function chartOfName(name: string): Chart {
  const found = CHARTS.find((chart) => DIFFICULTY_NAME[chart] === name);
  if (found === undefined) {
    throw new Error(`全曲リストに無い難易度: ${name}`);
  }
  return found;
}
