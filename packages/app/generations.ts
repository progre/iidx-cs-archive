// 原盤を読む素材世代を決める。PB は他の原盤を読む土台なので、必ず読み、ここでは扱わない。

import {
  GENERATIONS,
  PB_GENERATION,
  selectedGenerations,
} from "@csa/selection-definitions";

/** `--skip`の値。世代をカンマで区切る。PB は外せない */
export function skippedOf(text: string | undefined): string[] {
  const skipped = (text ?? "").split(",").map((each) => each.trim())
    .filter((each) => each !== "");
  if (skipped.includes(PB_GENERATION)) {
    throw new Error("PB の原盤は必ず読むので、--skip に書けない");
  }
  return selectedGenerations(skipped);
}

/** `skipped`の世代を除く */
export const withoutSkipped = (
  generations: readonly string[],
  skipped: readonly string[],
): string[] => generations.filter((each) => !skipped.includes(each));

/**
 * イメージファイルを置いた素材世代。`folders`は世代 → イメージのフォルダー名で、`hasFolder`はフォルダーがあるかを返す。
 * PB のフォルダーが無ければ止める
 */
export function imageGenerations(
  folders: Readonly<Record<string, string>>,
  hasFolder: (folder: string) => boolean,
): string[] {
  const placed = (generation: string) =>
    folders[generation] !== undefined && hasFolder(folders[generation]);
  if (!placed(PB_GENERATION)) {
    throw new Error("PB の原盤のイメージファイルが無い");
  }
  return GENERATIONS.filter(placed);
}
