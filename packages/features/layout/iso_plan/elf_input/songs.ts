// 曲DBの枠1つぶんの入力を、manifestと配置計画から組む。
// 素材のパスも表示する曲名も持ち込まない。
import { decodeBase64 } from "@std/encoding/base64";
import type {
  AssetReference,
  IndividualAssetManifest,
  ManifestOverlay,
  ManifestOverlayPackage,
  ManifestVariant,
} from "@csa/core";
import type { PlacementPlan, PlannedAsset, TitleSpriteRef } from "../types.ts";
import {
  overlayIndexLookup,
  plannedOverlayIndices,
  songOverlayOf,
} from "./overlay.ts";

export interface ElfSongParts {
  abcReferences: {
    fieldOffset: number;
    newAbcIndex: number;
    width: AssetReference["width"];
  }[];
  entry: Uint8Array;
  entryRanges: [number, number][];
  /** 曲DBへ書く前に欄を消す譜面の難易度名 */
  excludedCharts: readonly string[];
  fiveKeyFrontIndex: number | undefined;
  movedCharts: Record<string, string> | undefined;
  overlay: ManifestOverlay;
  overlayIndexOf: (item: ManifestOverlayPackage) => number;
  /** オーバーレイをANOTHERのときだけ使う */
  overlayOnlyAnother: boolean;
  /** 音とオーバーレイを共有するPB原盤の曲index */
  sharedWith: number | undefined;
  targetSongIndex: number;
  titleSprites: TitleSpriteRef[] | undefined;
  variantOf: ManifestVariant | undefined;
  videoFields: number[];
}

const assetsBySong = (plan: PlacementPlan): Map<number, PlannedAsset[]> => {
  const assetsOf = new Map<number, PlannedAsset[]>();
  for (const asset of plan.assets) {
    const found = assetsOf.get(asset.targetSongIndex) ?? [];
    found.push(asset);
    assetsOf.set(asset.targetSongIndex, found);
  }
  return assetsOf;
};

/** 配置計画とmanifestが、同じ件数の新規ABCを数えているか確かめる */
export function assertPlanMatchesManifest(
  manifest: IndividualAssetManifest,
  plan: PlacementPlan,
): void {
  if (plan.assets.length !== manifest.expectedNewAbcCount) {
    throw new Error("配置計画とmanifestのABC件数が一致しない");
  }
}

/** manifestの曲ごとに、曲DBへ書く値を組む。素材が渡されていない世代の曲は例外を投げる */
export function elfSongPartsOf(
  manifest: IndividualAssetManifest,
  plan: PlacementPlan,
  songSprites: ReadonlyMap<number, TitleSpriteRef[]>,
): ElfSongParts[] {
  const indices = plannedOverlayIndices(plan);
  const assetsOf = assetsBySong(plan);
  return manifest.songs.map((song) => {
    const source = manifest.sources[song.sourceGeneration];
    if (source === undefined) {
      throw new Error(`${song.sourceGeneration}の素材が渡されていない`);
    }
    return {
      abcReferences: (assetsOf.get(song.targetSongIndex) ?? []).flatMap(
        (asset) =>
          asset.references.map((reference) => ({
            fieldOffset: reference.fieldOffset,
            newAbcIndex: asset.newAbcIndex,
            width: reference.width,
          })),
      ),
      entry: decodeBase64(song.entry),
      entryRanges: source.entryRanges,
      excludedCharts: song.excludedCharts ?? [],
      fiveKeyFrontIndex: song.fiveKeyOf?.targetSongIndex,
      movedCharts: song.movedCharts,
      ...(song.fiveKeyOf?.ownLevels ? { fiveKeyOwnLevels: true } : {}),
      overlay: songOverlayOf(song),
      overlayIndexOf: overlayIndexLookup(song, indices),
      overlayOnlyAnother: song.overlayOnlyAnother === true,
      sharedWith: song.sharedWith?.targetSongIndex,
      targetSongIndex: song.targetSongIndex,
      titleSprites: songSprites.get(song.targetSongIndex),
      variantOf: song.variantOf,
      videoFields: song.videoFields,
    };
  });
}
