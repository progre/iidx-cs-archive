import type { ManifestSongDraft } from "@csa/core";
// 全曲リストの収録の指定のうち、組が成り立たないものと、仕様を決めていないものを見つける。
// 5鍵盤版と裏エントリーは、組になる同じ世代の曲を参照する。
// 参照先を全曲リストで外したり書かなかったりすると、組が成り立たない。
// 別の世代の曲を表にする組は、表の世代の全曲リストを`withOtherGenerationFronts`と
// `withOtherGenerationFiveKeys`が調べる。

/** 同じ世代の組の相手のsong_id */
const partnersOf = (row: ManifestSongDraft): number[] =>
  [
    row.fiveKeyOf?.generation === undefined ? row.fiveKeyOf?.songId : undefined,
    row.variantOf?.generation === undefined ? row.variantOf?.songId : undefined,
  ].filter((songId) => songId !== undefined);

/** 収録する行のうち、参照先が収録されない行を、`世代/songId → 参照先`の形で返す */
export function brokenPairsOf(rows: readonly ManifestSongDraft[]): string[] {
  const rowOf = new Map(rows.map((row) => [row.sourceSongIndex, row]));
  const isIncluded = (songId: number) => {
    const row = rowOf.get(songId);
    return row !== undefined && row.excluded === undefined;
  };
  return rows
    .filter((row) => row.excluded === undefined)
    .flatMap((row) =>
      partnersOf(row)
        .filter((songId) => !isIncluded(songId))
        .map((songId) =>
          `${row.sourceGeneration}/${row.sourceSongIndex} → ${row.sourceGeneration}/${songId}`
        )
    );
}

/**
 * `share`を書いた曲のうち、どう扱うかがまだ決まっていない曲を、`世代/songId`に理由を添えて返す。
 * 決まっていないのは、外した曲と、5鍵盤版か裏エントリーの組に入っている曲である。組の表の曲も含む
 */
export function undefinedSharesOf(
  rows: readonly ManifestSongDraft[],
): string[] {
  const partnered = new Set(rows.flatMap(partnersOf));
  return rows
    .filter((row) => row.share !== undefined)
    .flatMap((row) => {
      const key = `${row.sourceGeneration}/${row.sourceSongIndex}`;
      return [
        ...(row.excluded ? [`${key} excludeを書いた行に共有を書いた`] : []),
        ...(partnersOf(row).length > 0 || row.variantOf !== undefined ||
            partnered.has(row.sourceSongIndex)
          ? [`${key} 5鍵盤版か裏エントリーの組に入る`]
          : []),
      ];
    });
}

/**
 * 譜面を外した曲のうち、どう扱うかがまだ決まっていない曲を、`世代/songId`に理由を添えて返す。
 * 決まっていないのは、次の2つである。
 * - 全部の譜面を外した曲
 * - 5鍵盤版か裏エントリーの組に入っている曲。組の表の曲も含む
 * 曲に無い譜面の`x`は、外す譜面が無いだけなので数えない。
 */
export function undefinedChartExclusionsOf(
  rows: readonly ManifestSongDraft[],
): string[] {
  // 全曲リストで書いた5鍵盤版の組は、レベルを写さないので、表の譜面を外しても組が壊れない
  const pairedOf = (row: ManifestSongDraft) =>
    row.fiveKeyOf?.ownLevels ? [] : partnersOf(row);
  const partnered = new Set(rows.flatMap(pairedOf));
  return rows
    .filter((row) => row.excluded === undefined && row.excludedCharts)
    .flatMap((row) => {
      const excluded = new Set(row.excludedCharts);
      const charts = row.sourceAssets
        .filter((asset) => asset.kind === "chart")
        .flatMap((asset) => asset.fields);
      const key = `${row.sourceGeneration}/${row.sourceSongIndex}`;
      return [
        ...(charts.every((name) => excluded.has(name))
          ? [`${key} 全部の譜面を外した`]
          : []),
        ...(pairedOf(row).length > 0 || partnered.has(row.sourceSongIndex)
          ? [`${key} 5鍵盤版か裏エントリーの組に入る`]
          : []),
      ];
    });
}

function failIfAny(errors: readonly string[], message: string): void {
  if (errors.length > 0) {
    throw new Error(`${message}: ${errors.join(", ")}`);
  }
}

/** 5鍵盤版と裏エントリーの組の相手を、全曲リストで外したり書かなかったりしていれば止める */
export const assertPairsIncluded = (rows: readonly ManifestSongDraft[]): void =>
  failIfAny(
    brokenPairsOf(rows),
    "組の相手が収録されない曲がある。相手の曲を全曲リストに載せ、excludeを空にする",
  );

/** 共有の指定のうち、仕様を決めていないものがあれば止める */
export const assertShares = (rows: readonly ManifestSongDraft[]): void =>
  failIfAny(undefinedSharesOf(rows), "音とオーバーレイを共有できない曲がある");

/** 譜面を外す指定のうち、書き誤りと、仕様を決めていないものがあれば止める */
export const assertChartExclusions = (
  rows: readonly ManifestSongDraft[],
): void =>
  failIfAny(undefinedChartExclusionsOf(rows), "譜面を外せない曲がある");
