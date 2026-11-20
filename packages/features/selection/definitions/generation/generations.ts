// 素材世代の一覧と、世代で決まる原盤の性質。値は`definitions.csv`が持つ。

import type { ChartFormat, KeysoundForm } from "@csa/core";
import {
  definitionOfGeneration,
  DEFINITIONS,
  elfDefinitionOf,
  type Era,
} from "../table.ts";

/** CSAの曲の素材になる世代。PBは土台の原盤なので含めない。並びは発売順 */
export const GENERATIONS: readonly string[] = DEFINITIONS
  .map((def) => def.generation)
  .filter((generation) => generation !== "pb");

function fail(message: string): never {
  throw new Error(message);
}

export const chartFormatOf = (generation: string): ChartFormat =>
  definitionOfGeneration(generation).chartFormat;

export const eraOf = (generation: string): Era =>
  definitionOfGeneration(generation).era ??
    fail(`eraが未登録の世代: ${generation}`);

export const keysoundFormOf = (generation: string): KeysoundForm =>
  definitionOfGeneration(generation).keysoundForm ??
    fail(`キー音形式が未登録の世代: ${generation}`);

export const keysoundRetriggerCutOf = (generation: string): boolean =>
  definitionOfGeneration(generation).keysoundRetriggerCut;

/** 曲が参照するファイルのうち、譜面(拡張子`.ply`)を指すものの通し番号 */
/** PBの世代ID。CSAはPBの原盤を元に作る */
export const PB_GENERATION = "pb";

/** 読む素材世代を、発売順に並べ直す。知らない世代と PB を渡したら止める */
export function selectedGenerations(selected: readonly string[]): string[] {
  const unknown = selected.filter((generation) =>
    !GENERATIONS.includes(generation)
  );
  if (unknown.length > 0) {
    throw new Error(`素材世代ではない: ${unknown.join(", ")}`);
  }
  return GENERATIONS.filter((generation) => selected.includes(generation));
}

/** 原盤を読む順。選んだ世代を発売順に読み、usはempの前に読み、PBは最後に読む */
export const lapOrderOf = (selected: readonly string[]): string[] => {
  const generations = selectedGenerations(selected);
  const late = ["us", "emp"].filter((each) => generations.includes(each));
  return [
    ...generations.filter((each) => !late.includes(each)),
    ...late,
    PB_GENERATION,
  ];
};

/** 索引の並び。選んだ世代を発売順に並べ、PBを最後に置く */
export const indexGenerationsOf = (selected: readonly string[]): string[] => [
  ...selectedGenerations(selected),
  PB_GENERATION,
];

export function chartFileIndices(
  files: readonly { readonly refs: readonly string[] }[],
): number[] {
  return files.flatMap((file, index) =>
    file.refs.some((name) => name.toLowerCase().endsWith(".ply")) ? [index] : []
  );
}

/**
 * 曲DBの1件の長さがPBと同じ素材世代は、エントリをそのまま写せる。
 * 長さが違う世代は、PB形式のエントリを組み立てる(`contents/song_db`の`synthesis/`)
 */
export function songDbPath(generation: string): "copy" | "synthesize" {
  const pbLength = elfDefinitionOf("pb").songDbRecordLength;
  return generation !== "pb" &&
      elfDefinitionOf(generation).songDbRecordLength === pbLength
    ? "copy"
    : "synthesize";
}
