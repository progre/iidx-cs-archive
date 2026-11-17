// 周回で書いたbundleを、最終の選曲に合わせる。
// 最終の曲の音は、周回で書いた音の並びの部分列である。
// 外れた音があれば、残す音だけを詰めた別のファイルを書く。周回のファイルは、次のビルドが使い回すので書き換えない。
// 外れた音が無ければ、周回のファイルをそのまま使い、位置の採番だけをやり直す。

import type { IndividualAssetManifest } from "@csa/core";
import type { SoundLap } from "../lap.ts";
import { soundMapsOf } from "../rows.ts";
import {
  assertDiscsDirectory,
  soundBundlePaths,
  soundBundleSummary,
} from "../targets.ts";
import { settleGeneration } from "./settle.ts";

export interface PreparedSoundBundles<
  M extends IndividualAssetManifest = IndividualAssetManifest,
> {
  /** source key → bundle path。`manifestAssetSources` の生成物として渡す */
  bundles: Map<string, string>;
  manifest: M;
  /** 世代 → キー音file index → 旧→新 `entry_id`(era1のみ)。譜面の変換に渡す */
  soundMaps: Map<string, Map<number, Record<string, number>>>;
  summary: string;
}

/**
 * manifestの音を世代別に周回の結果と突き合わせ、変わったものだけbundleへ向け直したmanifestを返す。
 * 原盤は読まない。`writeKeptBundle`は、残す範囲だけを別のファイルへ写す
 */
export function prepareSoundBundles<M extends IndividualAssetManifest>(
  writeKeptBundle: (
    path: string,
    kept: readonly { offset: number; size: number }[],
    output: string,
  ) => void,
  source: M,
  discsDirectory: string,
  laps: ReadonlyMap<string, SoundLap>,
): PreparedSoundBundles<M> {
  assertDiscsDirectory(discsDirectory);
  const manifest = structuredClone(source);
  const bundles = new Map<string, string>();
  const soundMaps = new Map<string, Map<number, Record<string, number>>>();
  const summaries: string[] = [];
  for (const generation of Object.keys(manifest.sources)) {
    const lap = laps.get(generation);
    if (lap === undefined) {
      throw new Error(`${generation}の音の周回結果が無い`);
    }
    const settled = settleGeneration(manifest, generation, lap.occurrences);
    const { kept } = settled;
    if (lap.bundlePath !== undefined && kept.kept.length > 0) {
      const paths = soundBundlePaths(discsDirectory, generation);
      if (kept.dropped) {
        writeKeptBundle(lap.bundlePath, kept.kept, paths.settled);
      }
      bundles.set(
        paths.source,
        kept.dropped ? paths.settled : lap.bundlePath,
      );
    }
    soundMaps.set(generation, soundMapsOf(settled.rows));
    summaries.push(settled.summary);
  }
  return {
    bundles,
    manifest,
    soundMaps,
    summary: soundBundleSummary(summaries),
  };
}
