// 新規資産は原盤の空いた領域へ先に置き、残りを原盤のボリューム終端へ曲順・種別順に連ねる。
// ABC表には絶対LBAをタグ3で書く。
// A/B/Cは複製しないので、ISO9660の単一ファイル上限に縛られない。
// ELFはDATA1追記の後ろへ置くので、資産の位置はELFの長さに依らない。
import {
  assetGenerationOf,
  type IndividualAssetManifest,
  SEC,
} from "@csa/core";
import { FIRST_NEW_ABC, newAbcIndices } from "./abc_index.ts";
import type {
  ImageSetFile,
  PlacementPlan,
  PlannedAsset,
  PlannedPlacement,
  PlannedRange,
} from "../types.ts";
import { planData1 } from "./data1.ts";
import { allocator } from "./reuse.ts";

/** ABC表`+0`の下位30bitに収まるLBAの上限。タグ3は絶対LBAなのでイメージ全体の上限になる */
const LBA_LIMIT = 1 << 30;

export interface PlanInput {
  abcCapacity: number;
  /** 再構築した共有画像セット。既存DATA1 indexへ置き換える */
  imageSetFiles: ImageSetFile[];
  /** PB原盤のDATA1.DAT先頭LBA。新規 `.if` のTOC相対セクタの基準 */
  data1BaseLba: number;
  /** どの曲も指さなくなった原盤の領域。新規資産を先にここへ置く */
  reusableRanges: PlannedRange[];
  sourceVolumeSectors: number;
}

function sectors(bytes: number): number {
  return Math.ceil(bytes / SEC);
}

function validateManifest(manifest: IndividualAssetManifest): void {
  const frontIndices = new Set(
    manifest.songs.filter((song) => song.variantOf === undefined)
      .map((song) => song.targetSongIndex),
  );
  const pbSlots = new Set((manifest.pbBacks ?? []).map((back) => back.songId));
  const keys = new Set<string>();
  let count = 0;
  let frontCount = 0;
  let variantCount = 0;
  for (const song of manifest.songs) {
    // 選曲できる曲は99から連番、裏エントリーは窓(targetSongCount)の外へ続けて並ぶ。
    // 表を PB 以外の版にした組の表の曲は、PB の曲の枠に置く
    const expected = song.variantOf !== undefined
      ? manifest.targetSongCount + variantCount++
      : pbSlots.has(song.targetSongIndex)
      ? song.targetSongIndex
      : 99 + frontCount++;
    if (song.targetSongIndex !== expected) {
      throw new Error(
        `target song indexが連続していない: ${song.targetSongIndex}`,
      );
    }
    if (song.variantOf === undefined) {
      // 配置器は裏エントリーへ差し替え元の枠を写すので、表が先に並んでいる必要がある
      if (variantCount > 0) {
        throw new Error("裏エントリーの後ろに選曲できる曲がある");
      }
    } else if (
      // 99未満の枠はPB原盤の曲で、manifestに載らなくても曲DBにある
      song.variantOf.targetSongIndex >= 99 &&
      !frontIndices.has(song.variantOf.targetSongIndex)
    ) {
      throw new Error(
        `裏エントリーの差し替え元が無い: ${song.variantOf.targetSongIndex}`,
      );
    }
    // 同じ曲の別作品版は別の曲として載せるので、一意性は素材の世代とindexで見る。
    // 全曲リストで2行に書いた曲は、行ごとに別の曲として載せるので、全曲リストの行番号も比べる。
    // 裏エントリーは、差し替え元の曲の枠の番号でも見分ける
    const key = `${song.sourceGeneration}/${song.sourceSongIndex}` +
      `@${song.catalogLine}` +
      (song.variantOf === undefined
        ? ""
        : `→${song.variantOf.targetSongIndex}`);
    if (keys.has(key)) throw new Error(`素材の曲が重複: ${key}`);
    keys.add(key);
    count += song.assets.length;
  }
  // 実曲より多い目標曲数は、ELF側のクローンがそのまま残る(1408曲版の実曲183曲など)
  if (manifest.targetSongCount < 99 + frontCount) {
    throw new Error("manifestのtargetSongCountが99+曲数より小さい");
  }
  if (count !== manifest.expectedNewAbcCount) {
    throw new Error(
      `manifest ABC件数 ${count} != ${manifest.expectedNewAbcCount}`,
    );
  }
}

export function createPlacementPlan(
  manifest: IndividualAssetManifest,
  input: PlanInput,
): PlacementPlan {
  validateManifest(manifest);
  const abcIndices = newAbcIndices(manifest);
  const requiredCapacity = FIRST_NEW_ABC + new Set(abcIndices.flat()).size;
  if (input.abcCapacity < requiredCapacity) {
    throw new Error(`ABC capacity ${input.abcCapacity} < ${requiredCapacity}`);
  }
  const assetStartLba = input.sourceVolumeSectors;
  const space = allocator(input.reusableRanges, input.sourceVolumeSectors);
  const assets: PlannedAsset[] = [];
  const placements: PlannedPlacement[] = [];
  const placed = new Map<number, PlannedPlacement>();
  for (const [songIndex, song] of manifest.songs.entries()) {
    for (const [assetIndex, asset] of song.assets.entries()) {
      const newAbcIndex = abcIndices[songIndex][assetIndex];
      let placement = placed.get(newAbcIndex);
      if (placement === undefined) {
        placement = {
          lba: space.allocate(sectors(asset.sourceSize)),
          newAbcIndex,
          sectors: sectors(asset.sourceSize),
          sourceArchive: asset.sourceArchive,
          sourceGeneration: assetGenerationOf(song, asset),
          sourceOffset: asset.sourceOffset,
          sourceSize: asset.sourceSize,
        };
        placed.set(newAbcIndex, placement);
        placements.push(placement);
      }
      assets.push({
        ...asset,
        lba: placement.lba,
        newAbcIndex,
        sectors: placement.sectors,
        sourceGeneration: assetGenerationOf(song, asset),
        sourceSongIndex: song.sourceSongIndex,
        targetSongIndex: song.targetSongIndex,
        title: song.title,
      });
    }
  }
  const cursor = space.end();
  if (cursor > LBA_LIMIT) {
    throw new Error(`新規資産の終端LBAがABC表の30bitを超える: ${cursor}`);
  }
  const data1 = planData1(
    manifest,
    input.imageSetFiles,
    cursor,
    input.data1BaseLba,
  );
  return {
    abcCapacity: input.abcCapacity,
    assetRange: { endLba: cursor, startLba: assetStartLba },
    assets,
    data1,
    placements,
    reusedRanges: input.reusableRanges,
    targetSongCount: manifest.targetSongCount,
    totalSectors: data1.endLba,
  };
}
