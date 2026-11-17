// era1の変換済み譜面を、どの譜面に作るかの規則。
import type { IndividualAssetManifest } from "@csa/core";

function fail(message: string): never {
  throw new Error(message);
}

/** 変換する譜面1つ。`fieldOffset`は曲DBエントリの譜面欄 */
export interface Era1ChartTarget {
  fieldOffset: number;
  generation: string;
  sourceFileIndex: number;
  sourceSongIndex: number;
  title: string;
}

/** manifestの曲のうち、era1の世代`generation`の譜面資産すべて */
export function era1ChartTargets(
  manifest: IndividualAssetManifest,
  generation: string,
): Era1ChartTarget[] {
  return manifest.songs
    .filter((song) => song.sourceGeneration === generation)
    .flatMap((song) =>
      song.assets
        .filter((asset) => asset.kind === "chart")
        .map((asset) => ({
          fieldOffset: asset.references[0].fieldOffset,
          generation: song.sourceGeneration,
          sourceFileIndex: asset.sourceFileIndex,
          sourceSongIndex: song.sourceSongIndex,
          title: song.title,
        }))
    );
}

/**
 * 同じ譜面を複数の曲・難易度が指すときは、同じキー音バンクで変換する。
 * 変換済みのキー音バンクが今回と違えば、作り直さずに失敗させる。
 */
export function assertSameKeysoundBank(
  label: string,
  convertedKeysound: number,
  keysound: number,
): void {
  if (convertedKeysound !== keysound) {
    fail(`${label} は別のキー音バンク${convertedKeysound}で変換済み`);
  }
}
