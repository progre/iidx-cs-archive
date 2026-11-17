// 追加曲の曲名カード `.if`・曲中オーバーレイ・再構築した共有画像セットをDATA1へ割り当て、
// C.DATの後ろへ連続配置する。
// TOCのセクタ位置はDATA1先頭LBAからの相対値なので、DATA1本体は動かさずに済む。
import { type IndividualAssetManifest, overlayKey, SEC } from "@csa/core";
import type {
  ImageSetFile,
  PlannedData1,
  PlannedImageSet,
  PlannedOverlayPackage,
  PlannedTitleCard,
} from "../types.ts";

/** PB原盤のDATA1 TOC件数。新規 `.if` はこの次から採番する */
export const FIRST_NEW_DATA1 = 1469;

function sectorsOf(bytes: number): number {
  return Math.ceil(bytes / SEC);
}

export function planData1(
  manifest: IndividualAssetManifest,
  imageSetFiles: ImageSetFile[],
  startLba: number,
  baseLba: number,
): PlannedData1 {
  // 同じ`.if`でも世代が違えば別物なので、世代名と組にして共有を判定する。
  // `pairs`は曲ごとの参照なので鍵に含める。同じ`.if`を別の`pairs`で指す曲
  // (gold『DENI』の2エントリ)は、DATA1へ同じ中身をもう1件置いて別々に指す。
  const bySource = new Map<string, PlannedTitleCard>();
  // sheet上限で分けた追加画像セットは`FIRST_NEW_DATA1`から順に採番済みで、曲名カードはその後ろ
  const extraImageSetCount =
    imageSetFiles.filter((file) => file.data1Index >= FIRST_NEW_DATA1).length;
  let cursor = startLba;
  for (const song of manifest.songs) {
    // 曲名カードを持たない曲(legacyで3段組が帯に分かれない曲)は元の参照を残す
    const card = song.titleCard;
    if (card === undefined) continue;
    const sourceKey = song.sourceGeneration + "/" + card.sourceFileIndex +
      "/" + JSON.stringify(card.pairs);
    const shared = bySource.get(sourceKey);
    if (shared) {
      if (
        shared.sourceOffset !== card.sourceOffset ||
        shared.sourceSize !== card.sourceSize
      ) {
        throw new Error(
          `source .if ${card.sourceFileIndex} の位置が曲間で一致しない`,
        );
      }
      shared.targetSongIndices.push(song.targetSongIndex);
      continue;
    }
    if (card.sourceSize % SEC !== 0) {
      throw new Error(`source .if ${card.sourceFileIndex} がセクタ倍数でない`);
    }
    const sectors = card.sourceSize / SEC;
    bySource.set(sourceKey, {
      lba: cursor,
      newData1Index: FIRST_NEW_DATA1 + extraImageSetCount + bySource.size,
      pairs: card.pairs,
      relativeSector: cursor - baseLba,
      sectors,
      sourceArchive: card.sourceArchive,
      sourceFileIndex: card.sourceFileIndex,
      sourceGeneration: song.sourceGeneration,
      sourceOffset: card.sourceOffset,
      sourceSize: card.sourceSize,
      targetSongIndices: [song.targetSongIndex],
    });
    cursor += sectors;
  }
  // オーバーレイは同じ世代の同じ実体なら1件を共有する。組は曲DB側にだけ書くので、
  // 曲名カードと違って鍵に含めない
  const byOverlay = new Map<string, PlannedOverlayPackage>();
  const firstOverlayIndex = FIRST_NEW_DATA1 + extraImageSetCount +
    bySource.size;
  for (const song of manifest.songs) {
    for (const item of song.overlay?.packages ?? []) {
      const key = overlayKey(song.sourceGeneration, item);
      const shared = byOverlay.get(key);
      if (shared !== undefined) {
        if (
          shared.sourceOffset !== item.sourceOffset ||
          shared.sourceSize !== item.sourceSize
        ) {
          throw new Error(`オーバーレイ${key}の位置が曲間で一致しない`);
        }
        continue;
      }
      if (item.sourceSize % SEC !== 0) {
        throw new Error(`オーバーレイ${key}がセクタ倍数でない`);
      }
      const sectors = item.sourceSize / SEC;
      byOverlay.set(key, {
        lba: cursor,
        newData1Index: firstOverlayIndex + byOverlay.size,
        relativeSector: cursor - baseLba,
        sectors,
        sourceArchive: item.sourceArchive,
        sourceFileIndex: item.sourceFileIndex,
        sourceGeneration: song.sourceGeneration,
        sourceOffset: item.sourceOffset,
        sourceSize: item.sourceSize,
      });
      cursor += sectors;
    }
  }
  const extraIndices = imageSetFiles
    .map((file) => file.data1Index)
    .filter((index) => index >= FIRST_NEW_DATA1)
    .sort((a, b) => a - b);
  extraIndices.forEach((index, i) => {
    if (index !== FIRST_NEW_DATA1 + i) {
      throw new Error(`追加画像セット${index}の採番が連続していない`);
    }
  });
  const imageSets: PlannedImageSet[] = imageSetFiles.map((file) => {
    const sectors = sectorsOf(file.size);
    const planned = {
      data1Index: file.data1Index,
      lba: cursor,
      path: file.path,
      relativeSector: cursor - baseLba,
      sectors,
      size: file.size,
    };
    cursor += sectors;
    return planned;
  });
  return {
    imageSets,
    baseLba,
    endLba: cursor,
    overlayPackages: [...byOverlay.values()],
    startLba,
    titleCards: [...bySource.values()],
  };
}
