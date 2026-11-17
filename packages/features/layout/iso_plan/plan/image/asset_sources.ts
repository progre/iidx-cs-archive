// ISOへ写す資産の出どころを、source keyで引けるようにする。開く処理は呼び出し側が持つ。

import { generatedSourceArchive } from "@csa/core";

/**
 * 変換した音のbundleとmanifestが参照する単体ファイルは、パスで引く。
 * 譜面bundleはファイルに書いていないので、開く関数で引く。
 * 原盤のアーカイブは含めない。付け替え漏れがあると、引いた時点で例外を投げる。
 */
export function assetSourcesOf<Opened>(
  files: Iterable<readonly [key: string, path: string]>,
  generations: readonly string[],
  openChartImage: (generation: string) => Opened,
): Map<string, { path: string } | { open: () => Opened }> {
  return new Map<string, { path: string } | { open: () => Opened }>([
    ...[...files].map(([key, path]): [string, { path: string }] => [
      key,
      { path },
    ]),
    ...generations.map((generation): [string, { open: () => Opened }] => [
      generatedSourceArchive("chartBundle", generation),
      { open: () => openChartImage(generation) },
    ]),
  ]);
}
