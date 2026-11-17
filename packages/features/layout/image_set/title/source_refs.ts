// 追加曲を、曲名カードを写す曲とlegacyの曲に分け、曲DBの画像セット欄の初期値を決める。

import type { ManifestSong, TitleSpriteRef } from "@csa/core";

export interface SongGroups {
  /** 素材の画像セットがある世代の曲のうち、曲名カードがある曲である */
  cardSongs: ManifestSong[];
  /** 素材の画像セットが無い世代の曲である */
  legacySongs: ManifestSong[];
}

export function groupSongs(
  songs: readonly ManifestSong[],
  hasDisplayAssets: (generation: string) => boolean,
): SongGroups {
  return {
    cardSongs: songs.filter((song) =>
      hasDisplayAssets(song.sourceGeneration) && song.titleCard !== undefined
    ),
    legacySongs: songs.filter((song) =>
      !hasDisplayAssets(song.sourceGeneration)
    ),
  };
}

export const generationsOf = (songs: readonly ManifestSong[]): string[] => [
  ...new Set(songs.map((song) => song.sourceGeneration)),
];

export interface SourceRefs {
  /** 追加曲のtargetSongIndex → 素材側の曲名sprite参照4欄 */
  sourceRefs: Map<number, TitleSpriteRef[]>;
  /** 追加曲のtargetSongIndex → 素材世代名 */
  generationOf: Map<number, string>;
}

/** 曲ごとの素材側の参照を、追加先の曲番号で束ねる */
export function collectSourceRefs(
  songs: readonly ManifestSong[],
  refsOf: (song: ManifestSong) => TitleSpriteRef[],
): SourceRefs {
  return {
    generationOf: new Map(
      songs.map((song) => [song.targetSongIndex, song.sourceGeneration]),
    ),
    sourceRefs: new Map(
      songs.map((song) => [song.targetSongIndex, refsOf(song)]),
    ),
  };
}

/**
 * 曲DBの画像セット欄の初期値を作る。素材側の欄の並びを保ち、spriteだけを-1にする。
 * legacyの曲は素材側の参照が無いので、4欄ともfileとspriteを-1にする。
 * -1は、後で置き換える印である。
 */
export function initialSongSprites(
  sourceRefs: ReadonlyMap<number, TitleSpriteRef[]>,
  legacySongs: readonly ManifestSong[],
): Map<number, TitleSpriteRef[]> {
  const songSprites = new Map<number, TitleSpriteRef[]>(
    [...sourceRefs].map((
      [song, refs],
    ) => [song, refs.map((ref) => ({ ...ref, sprite: -1 }))]),
  );
  for (const { targetSongIndex: song } of legacySongs) {
    songSprites.set(
      song,
      Array.from({ length: 4 }, () => ({ fileIndex: -1, sprite: -1 })),
    );
  }
  return songSprites;
}
