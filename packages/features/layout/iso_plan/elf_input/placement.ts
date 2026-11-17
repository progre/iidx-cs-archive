// 配置計画のLBAと採番を、CSAのELFを作る関数が読む形へ並べ替える。
import type { IndividualAssetManifest } from "@csa/core";
import { abcIndexOfAsset } from "../plan/mod.ts";
import type { PlacementPlan, PlannedData1File } from "../types.ts";

const data1Row = (file: PlannedData1File) => ({
  lba: file.lba,
  newData1Index: file.newData1Index,
  relativeSector: file.relativeSector,
  sectors: file.sectors,
});

/** 追加フォルダーの名前の画像は、画像セットの組み立てが作るので含めない */
export const elfPlacementOf = (plan: PlacementPlan) => ({
  abcEntries: plan.placements.map((placed) => ({
    lba: placed.lba,
    newAbcIndex: placed.newAbcIndex,
    sectors: placed.sectors,
    sourceSize: placed.sourceSize,
  })),
  data1BaseLba: plan.data1.baseLba,
  imageSets: plan.data1.imageSets.map((imageSet) => ({
    lba: imageSet.lba,
    newData1Index: imageSet.data1Index,
    relativeSector: imageSet.relativeSector,
    sectors: imageSet.sectors,
  })),
  overlayPackages: plan.data1.overlayPackages.map(data1Row),
  titleCards: plan.data1.titleCards.map((card) => ({
    ...data1Row(card),
    pairs: card.pairs,
    targetSongIndices: card.targetSongIndices,
  })),
});

/** 空の`pairlessSongs`とPBムービーの付け替えは、キーごと省く */
export const elfContentOf = <Song, Pairless>(
  manifest: IndividualAssetManifest,
  songs: Song[],
  pairlessSongs: Pairless[],
) => ({
  ...(pairlessSongs.length === 0 ? {} : { pairlessSongs }),
  ...(manifest.pbVideoRedirects === undefined ? {} : {
    // CSAが置く資産へ向けた曲は、ここでその資産のABC indexを引く
    pbVideos: manifest.pbVideoRedirects.map((redirect) => ({
      abcIndex: "abcIndex" in redirect
        ? redirect.abcIndex
        : abcIndexOfAsset(manifest, redirect.asset),
      flags: redirect.flags,
      songIndex: redirect.songIndex,
    })),
  }),
  sharedVideoAbcIndex: manifest.sharedVideoAbcIndex,
  songs,
});
