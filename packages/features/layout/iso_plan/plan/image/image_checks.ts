// 書き出すISOの計画と、原盤イメージの突き合わせ。
// 原盤のファイル一覧と計画を受けて判断し、ISOもバイト列も読まない。

import {
  assetGenerationOf,
  type IndividualAssetManifest,
  parseGeneratedSource,
  SEC,
} from "@csa/core";
import type {
  PlacementPlan,
  PlannedData1File,
  PlannedPlacement,
  PlannedRange,
} from "../../types.ts";

/** 原盤イメージのISO9660上のファイル。名前は大文字 */
export type ImageFiles = ReadonlyMap<string, { lba: number; size: number }>;

/** 原盤の空いた領域に置く新規資産。複製した原盤の上に書き込む */
export const reusedPlacements = (plan: PlacementPlan): PlannedPlacement[] =>
  plan.placements.filter(({ lba }) => lba < plan.assetRange.startLba);

/** 原盤のボリューム終端から連ねる新規資産 */
export const appendedPlacements = (plan: PlacementPlan): PlannedPlacement[] =>
  plan.placements.filter(({ lba }) => lba >= plan.assetRange.startLba);

/**
 * DATA1に追記するファイルのうち、素材の範囲をそのまま写すものである。
 * 曲名カードの後ろにオーバーレイを置く。
 */
export const data1CopiedFiles = (plan: PlacementPlan): PlannedData1File[] => [
  ...plan.data1.titleCards,
  ...plan.data1.overlayPackages,
];

/** 配置計画から、書き出しと読み戻しが使う欄を取り出す */
export const imagePlanOf = (plan: PlacementPlan) => ({
  appended: appendedPlacements(plan),
  assetRange: plan.assetRange,
  data1: {
    copiedFiles: data1CopiedFiles(plan),
    endLba: plan.data1.endLba,
    imageSets: plan.data1.imageSets,
    overlayPackageCount: plan.data1.overlayPackages.length,
    startLba: plan.data1.startLba,
    titleCardCount: plan.data1.titleCards.length,
  },
  placements: plan.placements,
  reused: reusedPlacements(plan),
});

/** 周回で持ち帰った原盤の一覧と大きさで、素材の範囲が収まっているか確かめる */
export function validateSourceSlices(
  manifest: IndividualAssetManifest,
  discs: ReadonlyMap<string, { files: ImageFiles; size: number }>,
): void {
  for (const generation of Object.keys(manifest.sources)) {
    const info = discs.get(generation);
    if (info === undefined) {
      throw new Error(`${generation}の原盤の一覧が周回で作られていない`);
    }
    validateGenerationSlices(manifest, generation, info.files, info.size);
  }
}

/**
 * どの曲からも参照されなくなった原盤のファイルを、イメージ上のLBA範囲にする。
 * 末尾の端数のセクターは他のファイルと重なりうるので使わない
 */
export function freedRangesOf(
  files: ImageFiles,
  freedPbFiles: IndividualAssetManifest["freedPbFiles"],
): PlannedRange[] {
  return (freedPbFiles ?? []).map(({ abcIndex, archive, offset, size }) => {
    const found = files.get(archive.toUpperCase());
    if (found == null) {
      throw new Error(`ISO9660に${archive}が無い`);
    }
    if (offset % SEC !== 0 || offset + size > found.size) {
      throw new Error(
        `ABC ${abcIndex}が${archive}のセクター境界に無いか範囲外`,
      );
    }
    const startLba = found.lba + offset / SEC;
    return { endLba: startLba + Math.floor(size / SEC), startLba };
  });
}

/** 世代の原盤イメージから切り出す資産が、イメージの中に収まっているか確かめる */
export function validateGenerationSlices(
  manifest: IndividualAssetManifest,
  generation: string,
  files: ImageFiles,
  imageBytes: number,
): void {
  for (const song of manifest.songs) {
    const assets = song.assets.filter((asset) =>
      assetGenerationOf(song, asset) === generation
    );
    for (const asset of assets) {
      // 単体ファイルの資産は`OpenAssetSources`が開くときに存在を確かめる
      if (parseGeneratedSource(asset.sourceArchive) !== null) {
        continue;
      }
      const name = asset.sourceArchive.toUpperCase().split(";")[0];
      const archive = files.get(name);
      if (!archive) {
        throw new Error(`source ISOに${name}が無い`);
      }
      if (
        asset.sourceOffset < 0 || asset.sourceSize <= 0 ||
        asset.sourceOffset + asset.sourceSize > archive.size
      ) {
        throw new Error(
          `song${song.sourceSongIndex} file${asset.sourceFileIndex}が${name}の範囲外`,
        );
      }
      const absoluteEnd = archive.lba * SEC + asset.sourceOffset +
        asset.sourceSize;
      if (absoluteEnd > imageBytes) {
        throw new Error(
          `source sliceがimage終端を超える: file${asset.sourceFileIndex}`,
        );
      }
    }
  }
}

export const REGION_WINDOW_BYTES = 1024 * 1024;
const SAMPLE_WINDOWS = 16;

/** 先頭、末尾、固定の種から決めた16か所の窓の開始位置 */
function sampleOffsets(limit: number): number[] {
  const offsets = [0, limit - REGION_WINDOW_BYTES];
  let seed = 0x12345678;
  for (let i = 0; i < SAMPLE_WINDOWS; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    offsets.push(
      Math.floor((seed / 0x80000000) * (limit - REGION_WINDOW_BYTES)),
    );
  }
  return offsets;
}

/**
 * 原盤領域のうち、複製のまま変わらないはずの窓の開始位置。
 * 書き換えた範囲(`[開始, 終了)`)に掛かる窓は含めない
 */
export function untouchedWindows(
  regionBytes: number,
  rewritten: readonly (readonly [number, number])[],
): number[] {
  return sampleOffsets(regionBytes).filter((offset) =>
    !rewritten.some(([start, end]) =>
      offset < end && start < offset + REGION_WINDOW_BYTES
    )
  );
}
