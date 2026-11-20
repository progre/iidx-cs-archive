// 全曲リストに書いた5鍵盤版の組を、すべての世代を読み終えた後に、世代の行の5鍵盤版に結ぶ。
// 原作の組は、原盤の定義(`fiveKeyOf`)にあり、周回の中で結ぶ。

import type { CatalogFiveKey, CatalogRow, ManifestSongDraft } from "@csa/core";
import { includedSongIdOf, rowAtLine } from "./variants.ts";

const whereOf = ({ generation, line }: CatalogFiveKey) =>
  `${generation}の全曲リスト line ${line}`;

/** 5鍵盤版の曲の行に、表の曲を書く。全曲リストで書いた組の5鍵盤版は、自分のレベルを使う */
export function withCatalogFiveKeys(
  rowsOf: ReadonlyMap<string, readonly ManifestSongDraft[]>,
  catalogRows: ReadonlyMap<string, ReadonlyMap<number, CatalogRow>>,
  pairs: readonly CatalogFiveKey[],
): Map<string, ManifestSongDraft[]> {
  const result = new Map([...rowsOf].map(([gen, rows]) => [gen, [...rows]]));
  for (const pair of pairs) {
    const where = whereOf(pair);
    const { frontGeneration, generation } = pair;
    const rows = result.get(generation) ?? [];
    const at = rowAtLine(rows, pair.line, where);
    // 原作の組を、全曲リストの組より優先する
    if (rows[at].fiveKeyOf !== undefined) {
      continue;
    }
    rows[at] = {
      ...rows[at],
      fiveKeyOf: {
        ...(frontGeneration === generation
          ? {}
          : { generation: frontGeneration }),
        ownLevels: true,
        songId: includedSongIdOf(
          catalogRows.get(frontGeneration),
          frontGeneration,
          pair.frontTitle,
          where,
        ),
      },
    };
    result.set(generation, rows);
  }
  return result;
}
