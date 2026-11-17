// 世代の周回で書いた音声 bundle と、最終の選曲との突き合わせ。
// 周回は、選外になる曲も含めて、曲の並びのまま書く。最終の並びは、その部分列になる。

import type { ConvertedSize, SoundTarget } from "./rows.ts";

/** 周回で変換した音1つ。同じ原盤の範囲でも、曲ごとに1つ数える */
export interface SoundOccurrence {
  converted: ConvertedSize;
  key: string;
  /** 変換して変わらなかった音は、`sameAs`で同じ範囲の重複をなくし、変換の行は作らない */
  unchanged: boolean;
  /**
   * 前の音が原盤の同じ範囲をすでに書いていれば、ここにその音の添字を入れる。
   * この音のバイト列は書かず、前の音と同じ位置を指す。同じ範囲を2か所に置かないためである。
   */
  sameAs?: number;
}

/** 周回で書いた1世代分のbundleと、変換した音の並び */
export interface SoundLap {
  /** 音が1つも無ければ、bundleは作らない */
  bundlePath: string | undefined;
  generation: string;
  occurrences: SoundOccurrence[];
}

/** 音の原盤での位置。同じ位置と種別の音は、同じ変換結果になる */
export const soundTargetKey = ({ archiveName, asset, kind }: SoundTarget) =>
  [kind, archiveName, asset.sourceOffset, asset.sourceSize].join("\t");

/** 周回の並びのうち、最終の並びが使う位置。最終の並びが部分列でなければ例外にする */
export function retainedIndices(
  lapKeys: readonly string[],
  finalKeys: readonly string[],
): number[] {
  const indices: number[] = [];
  let at = 0;
  for (const key of finalKeys) {
    while (at < lapKeys.length && lapKeys[at] !== key) {
      at++;
    }
    if (at === lapKeys.length) {
      throw new Error(`周回で書いた音の並びに無い、または順が違う: ${key}`);
    }
    indices.push(at++);
  }
  return indices;
}

export interface BundleRange {
  offset: number;
  size: number;
}

/** 1つのファイルの中で、残す範囲を書いた順に並べたもの */
export interface KeptFile {
  /** 収録から除外された曲の音があれば、`true` */
  dropped: boolean;
  kept: BundleRange[];
}

export interface KeptRanges {
  /** bundleに残す範囲 */
  bundle: KeptFile;
  /** 並びの位置 → 残した後のファイル内の位置。バイト列を書いた音だけを持つ */
  offsetOf: ReadonlyMap<number, number>;
}

/**
 * 周回で書いたbundleの中で、残す音の範囲を、書いた順に返す。
 * 変わらなかった2つの音が原盤の同じ範囲を指すとき、後の音には`sameAs`が付く。
 * この場合は、先に書いた音の範囲だけを残す。
 */
export function keptRanges(
  occurrences: readonly SoundOccurrence[],
  retained: readonly number[],
): KeptRanges {
  const needed = new Set(
    retained.map((index) => occurrences[index].sameAs ?? index),
  );
  const bundle: KeptFile = { dropped: false, kept: [] };
  let from = 0;
  let to = 0;
  const offsetOf = new Map<number, number>();
  occurrences.forEach((occurrence, index) => {
    if (occurrence.sameAs !== undefined) {
      return;
    }
    const { size } = occurrence.converted;
    if (needed.has(index)) {
      bundle.kept.push({ offset: from, size });
      offsetOf.set(index, to);
      to += size;
    } else {
      bundle.dropped = true;
    }
    from += size;
  });
  return { bundle, offsetOf };
}
