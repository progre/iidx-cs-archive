// 組を持たない曲の記述子を素材のELFから読み、CSAのDATA1 indexへ振り直す。
// 対象の選別と振り直し先の決定は、呼び出し側が`ports`で渡す。

import { readDescriptor, rewritePairlessDescriptor } from "./descriptor.ts";

/** 記述子を振り直す候補の曲 */
export interface PairlessCandidate {
  descriptorOffset: number;
  sourceGeneration: string;
  targetSongIndex: number;
}

export interface PairlessPorts<C extends PairlessCandidate> {
  /** 振り直す候補の曲。世代ごとにまとめて渡す */
  candidates: readonly C[];
  /** 素材のパッケージ番号から、CSAのパッケージ番号を引く */
  packageLookup: (
    candidate: C,
  ) => (sourcePackage: number) => number | undefined;
  /** 実行ファイルは世代ごとに1回だけ読むので、世代ごとにまとめて並べる */
  mapByGeneration: <R>(
    items: readonly C[],
    generationOf: (item: C) => string,
    map: (item: C) => R,
  ) => R[];
}

export function pairlessSongsOf<C extends PairlessCandidate>(
  { candidates, mapByGeneration, packageLookup }: PairlessPorts<C>,
  sourceElfOf: (generation: string) => Uint8Array,
): { descriptor: Uint8Array; packageIndex: number; songIndex: number }[] {
  return mapByGeneration(
    candidates,
    (candidate) => candidate.sourceGeneration,
    (candidate) => {
      const { bytes, packageIndex } = rewritePairlessDescriptor(
        readDescriptor(
          sourceElfOf(candidate.sourceGeneration),
          candidate.descriptorOffset,
        ),
        packageLookup(candidate),
      );
      return {
        descriptor: bytes,
        packageIndex,
        songIndex: candidate.targetSongIndex,
      };
    },
  );
}
