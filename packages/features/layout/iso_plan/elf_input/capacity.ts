// CSAのELFが確保する表の件数を、manifestの曲数から数える。
import type { IndividualAssetManifest } from "@csa/core";

/** 原盤のABC表とDATA1に既にある件数。追加分はこの後ろへ並ぶ */
const ABC_IN_DISC = 1066;
const DATA1_IN_DISC = 1469;

/**
 * DATA1へ追記する上限。曲名カードは曲ごとに1本になる。
 * 曲中オーバーレイは組ごとに本数が違う。
 */
const data1Files = (manifest: IndividualAssetManifest): number =>
  manifest.songs.reduce(
    (sum, song) => sum + 1 + (song.overlay?.packages.length ?? 0),
    0,
  );

export interface SongCapacityDemand {
  abcNeeded: number;
  data1Needed: number;
  songCount: number;
  variants: number;
}

/**
 * 表の確保件数を決めるために必要な件数。素材を整える前のmanifestで数える。
 * 整える過程でオーバーレイは分割されうる。整えた後で数えると件数がずれる。
 */
export const songCapacityDemand = (
  manifest: IndividualAssetManifest,
): SongCapacityDemand => ({
  abcNeeded: ABC_IN_DISC + manifest.expectedNewAbcCount,
  data1Needed: DATA1_IN_DISC + data1Files(manifest),
  songCount: manifest.targetSongCount,
  // PB原盤の曲の写しの裏も、裏の枠を使う
  variants: manifest.songs.filter((song) => song.variantOf !== undefined)
    .length + (manifest.pbBacks?.length ?? 0),
});
