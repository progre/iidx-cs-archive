// 全曲リストに書いた5鍵盤版の組を、世代の行の5鍵盤版に結ぶ。
// 原作の組は、原盤の定義(`fiveKeyOf`)にある。

import type {
  CatalogFiveKey,
  CatalogRow,
  FiveKeyFront,
  ManifestSongDraft,
} from "@csa/core";
import { songIdOf } from "./variants.ts";

const whereOf = ({ generation, line }: CatalogFiveKey) =>
  `${generation}の全曲リスト line ${line}`;

const isOtherGeneration = (pair: CatalogFiveKey) =>
  pair.frontGeneration !== pair.generation;

/** 表の曲が別の世代なら、その世代を読み終えるまで song_id が分からないので、行番号から仮の値を作る */
const pendingFrontOf = (pair: CatalogFiveKey) => -pair.line;

/** 5鍵盤版の曲の曲番号 → 表の曲 */
export function fiveKeysOf(
  generation: string,
  rows: ReadonlyMap<number, CatalogRow>,
  pairs: readonly CatalogFiveKey[],
): Map<number, FiveKeyFront> {
  return new Map(
    pairs.filter((pair) => pair.generation === generation).map((pair) => {
      const where = whereOf(pair);
      const front: FiveKeyFront = isOtherGeneration(pair)
        ? {
          generation: pair.frontGeneration,
          ownLevels: true,
          songId: pendingFrontOf(pair),
        }
        : { ownLevels: true, songId: songIdOf(rows, pair.frontTitle, where) };
      return [songIdOf(rows, pair.title, where), front];
    }),
  );
}

/** すべての世代を読み終えた後に、別の世代の表の曲の song_id を書く */
export function withOtherGenerationFiveKeys(
  rowsOf: ReadonlyMap<string, readonly ManifestSongDraft[]>,
  catalogRows: ReadonlyMap<string, ReadonlyMap<number, CatalogRow>>,
  pairs: readonly CatalogFiveKey[],
): Map<string, ManifestSongDraft[]> {
  const result = new Map([...rowsOf].map(([gen, rows]) => [gen, [...rows]]));
  for (const pair of pairs.filter(isOtherGeneration)) {
    const where = whereOf(pair);
    const frontRows = catalogRows.get(pair.frontGeneration);
    const front = songIdOf(frontRows, pair.frontTitle, where);
    if (frontRows?.get(front)?.exclude) {
      throw new Error(
        `${where}: ${pair.frontGeneration}の全曲リストで${pair.frontTitle}を外している`,
      );
    }
    const rows = result.get(pair.generation) ?? [];
    const at = rows.findIndex((row) =>
      row.fiveKeyOf?.songId === pendingFrontOf(pair)
    );
    if (at < 0) {
      throw new Error(`${where}: 5鍵盤版の曲が行に無い`);
    }
    rows[at] = {
      ...rows[at],
      fiveKeyOf: {
        generation: pair.frontGeneration,
        ownLevels: true,
        songId: front,
      },
    };
  }
  return result;
}
