// 音のbundleへ変換する資産の選別と、bundleの置き場・要約の決まり。
import {
  generatedSourceArchive,
  type IndividualAssetManifest,
  INTERMEDIATE_DIRECTORY,
  type ManifestSong,
  parseGeneratedSource,
} from "@csa/core";
import type { SoundBundleRow, SoundKind, SoundTarget } from "./rows.ts";

const SOUND_KINDS: readonly string[] = ["bgm", "keysound"];

/** bundleは中間物なので、`INTERMEDIATE_DIRECTORY`以下にだけ置く */
export function assertDiscsDirectory(discsDirectory: string): void {
  if (!discsDirectory.startsWith(`${INTERMEDIATE_DIRECTORY}/`)) {
    throw new Error(
      `discsDirectoryは${INTERMEDIATE_DIRECTORY}/以下へ指定する`,
    );
  }
}

/**
 * 世代の曲のキー音とBGMから、変換の対象を曲順・資産順に選ぶ。
 * 単体ファイルへ差し替えた資産は変換済みなので含めない。
 */
export const soundTargetsOf = (
  manifest: IndividualAssetManifest,
  generation: string,
): SoundTarget[] => soundTargetsOfSongs(manifest.songs, generation);

/** 曲の並びから、世代の変換の対象を選ぶ。manifestにする前の曲でも使える */
export const soundTargetsOfSongs = (
  songs: readonly Pick<ManifestSong, "assets" | "sourceGeneration">[],
  generation: string,
): SoundTarget[] =>
  songs
    .filter((song) => song.sourceGeneration === generation)
    .flatMap((song) => song.assets)
    .filter((asset) =>
      SOUND_KINDS.includes(asset.kind) &&
      parseGeneratedSource(asset.sourceArchive) === null
    )
    .map((asset) => ({
      archiveName: asset.sourceArchive.toUpperCase().split(";")[0],
      asset,
      kind: asset.kind as SoundKind,
    }));

/** `discsDirectory`は、周回の成果物を世代ごとに置く場所 */
export const soundBundlePaths = (
  discsDirectory: string,
  generation: string,
) => ({
  bundle: `${discsDirectory}/${generation}/sound.bin`,
  /** `bundle`に書いた音の並びと変換の結果。次のビルドの周回が、`bundle`を使い回すかを決める */
  record: `${discsDirectory}/${generation}/sound.json`,
  /** 最終の選曲から外れた音を除いて詰めたbundle */
  settled: `${discsDirectory}/${generation}/sound_settled.bin`,
  source: generatedSourceArchive("soundBundle", generation),
});

export const soundGenerationSummary = (
  generation: string,
  total: number,
  rows: readonly SoundBundleRow[],
): string => `${generation} converted ${rows.length} of ${total}`;

export const soundBundleSummary = (generationSummaries: string[]): string =>
  "sound bundle: " + generationSummaries.join(" | ");
