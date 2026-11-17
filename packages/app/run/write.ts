// ISOの書き出しと読み戻し。計画から取り出した欄と、他の features が持つ検査を`@csa/containers-disc`へ渡す。

import {
  type AssetSourceMap,
  type ImageInput,
  type MetadataPatch,
  verifyImage as verifyDiscImage,
  writeImage as writeDiscImage,
} from "@csa/containers-disc";
import {
  type ElfPlacement,
  type FileRelocation,
  MutableElf,
  type SourcePatch,
  verifyFileTable,
} from "@csa/contents-elf";
import type { DiscImage, IndividualAssetManifest } from "@csa/core";
import { fileSourcesOf } from "@csa/layout-display-prepare";
import {
  assetSourcesOf,
  imagePlanOf,
  type PlacementPlan,
  REGION_WINDOW_BYTES,
  untouchedWindows,
} from "@csa/layout-iso-plan";

export type { MetadataPatch };

export interface WriteInput {
  assetSources: AssetSourceMap;
  elfBytes: Uint8Array;
  elfPlacement: ElfPlacement;
  outputPath: string;
  plan: PlacementPlan;
  /** 原盤領域の差し替え。複製の後に書く */
  sourcePatches: readonly SourcePatch[];
  sourceVolumeSectors: number;
}

/** 譜面bundleは、`chartKey`で引くたびに平文の譜面を1件ずつPBの鍵で暗号化して返す */
export const manifestAssetSources = (
  manifest: IndividualAssetManifest,
  bundles: ReadonlyMap<string, string>,
  openChartImage: (generation: string, chartKey: Uint8Array) => DiscImage,
  chartKey: Uint8Array,
): AssetSourceMap =>
  assetSourcesOf(
    [...bundles, ...fileSourcesOf(manifest)],
    Object.keys(manifest.sources),
    (generation) => openChartImage(generation, chartKey),
  );

const imageInputOf = (input: WriteInput): ImageInput => ({
  ...input,
  plan: imagePlanOf(input.plan),
});

/** `source`は、周回で開いたPBの原盤。複製と原盤領域の差し替えに使い、ここでは閉じない */
export const writeImage = (
  input: WriteInput,
  metadata: readonly MetadataPatch[],
  log: (line: string) => void,
  source: DiscImage,
): Promise<void> => writeDiscImage(imageInputOf(input), metadata, log, source);

/** `source`は、周回で開いたPBの原盤。原盤領域の照合に使い、ここでは閉じない */
export const verifyImage = (
  input: WriteInput,
  metadata: readonly MetadataPatch[],
  relocations: readonly FileRelocation[],
  log: (line: string) => void,
  source: DiscImage,
): Promise<void> =>
  verifyDiscImage(
    imageInputOf(input),
    metadata,
    {
      checkElf: (elf) => verifyFileTable(new MutableElf(elf), relocations),
      untouchedWindows,
      windowBytes: REGION_WINDOW_BYTES,
    },
    log,
    source,
  );
