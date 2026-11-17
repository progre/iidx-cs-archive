// 周回で書いた1世代分の音を、最終の選曲の音に合わせる。bundleは書き換えず、残す範囲と位置の採番を決める。

import type { IndividualAssetManifest } from "@csa/core";
import {
  type KeptFile,
  keptRanges,
  retainedIndices,
  type SoundOccurrence,
  soundTargetKey,
} from "../lap.ts";
import {
  type ConvertedSize,
  type SoundBundleRow,
  SoundBundleRows,
  type SoundTarget,
} from "../rows.ts";
import { soundGenerationSummary, soundTargetsOf } from "../targets.ts";

// 周回で変換した音の並び。
// 変換しても変わらなかった音は、原盤の同じ範囲を指すことがある。
// その場合、bundleへ書くのは最初の1つだけにする。
export class SoundOccurrences {
  readonly list: SoundOccurrence[] = [];
  readonly #firstOf = new Map<string, number>();

  /** 並びに加える。バイト列をbundleへ書くべきなら`true`を返す */
  add(
    target: SoundTarget,
    converted: ConvertedSize,
    unchanged: boolean,
  ): boolean {
    // 種別・アーカイブ名・位置・大きさがすべて同じ音は、1回だけ書く
    const sharedKey = [
      target.kind,
      target.asset.sourceArchive,
      target.asset.sourceOffset,
      target.asset.sourceSize,
    ].join("\t");
    const sameAs = unchanged ? this.#firstOf.get(sharedKey) : undefined;
    if (unchanged && sameAs === undefined) {
      this.#firstOf.set(sharedKey, this.list.length);
    }
    this.list.push({
      converted,
      key: soundTargetKey(target),
      sameAs,
      unchanged,
    });
    return sameAs === undefined;
  }
}

export interface SettledGeneration {
  /** bundleに残す範囲。`dropped`なら、ファイルを書き直す */
  kept: KeptFile;
  rows: SoundBundleRow[];
  summary: string;
}

/**
 * 世代の最終の音を周回の並びと突き合わせ、manifestの資産をbundle内の位置へ向け直す。
 * 最終の並びが周回の並びの部分列でなければ、例外にする。
 */
export function settleGeneration(
  manifest: IndividualAssetManifest,
  generation: string,
  occurrences: readonly SoundOccurrence[],
): SettledGeneration {
  const targets = soundTargetsOf(manifest, generation);
  const retained = retainedIndices(
    occurrences.map((each) => each.key),
    targets.map(soundTargetKey),
  );
  const bundle = new SoundBundleRows(generation);
  const { bundle: kept, offsetOf } = keptRanges(occurrences, retained);
  targets.forEach((target, index) => {
    const at = retained[index];
    const occurrence = occurrences[at];
    const offset = offsetOf.get(occurrence.sameAs ?? at);
    if (offset === undefined) {
      throw new Error(`${generation}の音の位置が決まらない`);
    }
    if (occurrence.unchanged) {
      bundle.addUnchanged(target, occurrence.converted.size, offset);
    } else {
      bundle.add(target, occurrence.converted, offset);
    }
  });
  return {
    kept,
    rows: bundle.rows,
    summary: soundGenerationSummary(generation, targets.length, bundle.rows),
  };
}
