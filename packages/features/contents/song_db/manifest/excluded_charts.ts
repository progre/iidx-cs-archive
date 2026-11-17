// 全曲リストで`x`を書いた譜面のファイルを、曲の下書きから外す。
// エントリの欄は残し、曲DBへ書くときに消す。曲リストが、外した譜面のレベルとノーツ数を見せるためである。
// 1つの譜面ファイルを複数の難易度で使うことがある。このため、譜面ファイルを外すのは、そのファイルを使う難易度がすべて外れたときに限る。

import type { ManifestAsset } from "@csa/core";
import type { PbEntryFormat } from "../pb/format/mod.ts";

function withoutFields(
  assets: readonly ManifestAsset[],
  fieldOffsets: ReadonlySet<number>,
): ManifestAsset[] {
  return assets.flatMap((asset) => {
    if (asset.kind !== "chart") {
      return [asset];
    }
    const references = asset.references.filter((reference) =>
      !fieldOffsets.has(reference.fieldOffset)
    );
    return references.length === 0 ? [] : [{ ...asset, references }];
  });
}

/** `names`は外す譜面の難易度名である */
export const withoutCharts = (
  format: PbEntryFormat,
  assets: readonly ManifestAsset[],
  names: readonly string[],
): ManifestAsset[] =>
  withoutFields(
    assets,
    new Set(names.map((name) => format.chartFieldOffset(name))),
  );
