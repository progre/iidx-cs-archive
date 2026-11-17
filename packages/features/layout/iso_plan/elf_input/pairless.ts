// 組を持たない曲の記述子を、CSAのDATA1 indexへ振り直す判断。
// manifestはJSONを経由するため`Uint8Array`を持てない。
// 記述子は素材のELFから直接読み、読み書きは contents/overlay が担う。
import type { IndividualAssetManifest, PairlessSourceSong } from "@csa/core";
import type { PlacementPlan } from "../types.ts";

export interface PairlessCandidate {
  descriptorOffset: number;
  sourceGeneration: string;
  targetSongIndex: number;
}

/**
 * 素材の曲のうち、組を持たない曲を探す。
 * 組を持たない曲の一覧は世代ごとに変わるので、引き方は呼び出し側が渡す。
 */
export const pairlessCandidatesOf = (
  manifest: IndividualAssetManifest,
  pairlessSongsOf: (generation: string) => readonly PairlessSourceSong[],
): PairlessCandidate[] =>
  manifest.songs.flatMap((song) => {
    const found = pairlessSongsOf(song.sourceGeneration).find(
      (candidate) => candidate.songIndex === song.sourceSongIndex,
    );
    return found === undefined ? [] : [{
      descriptorOffset: found.descriptorOffset,
      sourceGeneration: song.sourceGeneration,
      targetSongIndex: song.targetSongIndex,
    }];
  });

/**
 * 記述子の非零欄は、素材の1本を示す。
 * その1本を配置計画で探す。
 * 見つけたら、CSAのDATA1 indexを返す。
 * 分けた本は`sourceFileIndex`を引き継ぐので、2本以上なら欄が1本に収まらず例外を投げる。
 */
export const pairlessPackageLookup = (
  candidate: PairlessCandidate,
  plan: PlacementPlan,
) =>
(sourcePackage: number): number | undefined => {
  const placed = plan.data1.overlayPackages.filter((item) =>
    item.sourceGeneration === candidate.sourceGeneration &&
    item.sourceFileIndex === sourcePackage
  );
  if (placed.length > 1) {
    throw new Error(
      `song${candidate.targetSongIndex}のオーバーレイが分けられている`,
    );
  }
  return placed.at(0)?.newData1Index;
};
