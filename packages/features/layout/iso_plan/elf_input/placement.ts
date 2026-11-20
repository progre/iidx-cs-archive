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

/** PBの固定枠の数。選曲リストの窓は、ここから`targetSongCount`の手前までである */
const FIXED_SLOT_COUNT = 99;

/**
 * 選曲リストの窓のうち、曲を置かない曲index。
 * 一部の原盤だけで作ると、欠けた原盤の曲の曲indexが空く
 */
export const vacantSlotsOf = (manifest: IndividualAssetManifest): number[] => {
  const used = new Set(manifest.songs.map((song) => song.targetSongIndex));
  return Array.from(
    { length: manifest.targetSongCount - FIXED_SLOT_COUNT },
    (_, at) => FIXED_SLOT_COUNT + at,
  ).filter((index) => !used.has(index));
};

/** 空の`pairlessSongs`、PBムービーの付け替え、空いた曲indexは、キーごと省く */
export const elfContentOf = <Song, Pairless>(
  manifest: IndividualAssetManifest,
  songs: Song[],
  pairlessSongs: Pairless[],
) => ({
  ...(pairlessSongs.length === 0 ? {} : { pairlessSongs }),
  ...(vacantSlotsOf(manifest).length === 0
    ? {}
    : { vacantSlots: vacantSlotsOf(manifest) }),
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
