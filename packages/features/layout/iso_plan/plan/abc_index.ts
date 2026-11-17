// 新規資産のABC index。ゲームが譜面・音・ムービーを引く識別子で、曲DBの参照欄へ書く。
// 採番はmanifestの曲順・資産順だけで決まり、LBAや画像セットに依存しない。
// 配置計画より前に書く曲リストHTMLも、この関数で同じ値を出せる。

import {
  assetGenerationOf,
  type IndividualAssetManifest,
  type ManifestAsset,
  type ManifestSong,
} from "@csa/core";

/** 新規資産に振るABC indexの先頭。既存のABC表の後ろへ続ける */
export const FIRST_NEW_ABC = 1066;

/**
 * 資産の実体を見分ける鍵。素材の同じ範囲を指す資産は同じバイト列なので、
 * ISOへ1件だけ載せて同じABC indexを共有する。
 * 素材アーカイブの名前は世代をまたぐと重複するので、世代を鍵に含める。
 */
export const assetKey = (song: ManifestSong, asset: ManifestAsset): string =>
  [
    assetGenerationOf(song, asset),
    asset.sourceArchive,
    asset.sourceOffset,
    asset.sourceSize,
  ].join("|");

/** 曲ごとの、`song.assets`と同じ並びのABC index。同じ実体を指す資産は同じ値になる */
export function newAbcIndices(manifest: IndividualAssetManifest): number[][] {
  const assigned = new Map<string, number>();
  return manifest.songs.map((song) =>
    song.assets.map((asset) => {
      const key = assetKey(song, asset);
      const found = assigned.get(key);
      if (found !== undefined) return found;
      const index = FIRST_NEW_ABC + assigned.size;
      assigned.set(key, index);
      return index;
    })
  );
}

/**
 * CSAが置く資産のABC index。PBの曲のムービー欄を、CSAが置く資産へ向けるときに使う。
 * 素材の準備では、ムービーを中間ファイルへ写し、資産の置き場所もそのファイルへ書き換える。
 * 置き場所では区別できないので、世代と songmap のファイル番号で同じムービーを探す。
 * manifestのどの曲もそのムービーを持っていなければ、ABC indexが無いので止める
 */
export function abcIndexOfAsset(
  manifest: IndividualAssetManifest,
  asset: ManifestAsset,
): number {
  const generation = asset.sourceGeneration;
  if (generation === undefined) {
    throw new Error("資産の世代が無い");
  }
  const isSame = (song: ManifestSong, each: ManifestAsset) =>
    each.kind === asset.kind &&
    assetGenerationOf(song, each) === generation &&
    each.sourceFileIndex === asset.sourceFileIndex;
  const indices = newAbcIndices(manifest);
  for (const [songAt, song] of manifest.songs.entries()) {
    const assetAt = song.assets.findIndex((each) => isSame(song, each));
    if (assetAt >= 0) {
      return indices.at(songAt)!.at(assetAt)!;
    }
  }
  throw new Error(
    "PBの曲が指す資産を、どの曲も持っていない: " + generation + ":" +
      asset.sourceFileIndex,
  );
}
