// 曲のムービーを、PBで再生できるか、どの資産として置くかの判定。

import type {
  ManifestSongDraft,
  Resolution,
  SourceAsset,
  SourceSlice,
} from "@csa/core";

function fail(message: string): never {
  throw new Error(message);
}

/**
 * 原作のムービーをそのまま置けるか。
 * PBのムービー初期化は、曲DB`+0x62`の印で選ぶどちらかのバッファに収まればよい。
 * `fitsAnyBuffer`は、その判定を解像度について行う。
 * era1の`reencode`は240x240へ変換済みである。
 */
export const isOriginalVideoPlayable = (
  song: ManifestSongDraft,
  fitsAnyBuffer: (resolution: Resolution) => boolean,
): boolean =>
  song.sourceAssets.filter((asset) =>
    asset.kind === "video" && asset.path !== "excluded"
  ).every((asset) =>
    asset.path === "reencode" ||
    (asset.resolution !== undefined && fitsAnyBuffer(asset.resolution))
  );

/** 変換済みムービーのファイル。`archive`はmanifestに書くアーカイブ名、`size`はバイト数である */
export interface ConvertedFile {
  archive: string;
  size: number;
}

/** 変換済みムービーは単体ファイルとして置く。それ以外は原盤の位置をそのまま使う */
export function assetSource(
  asset: SourceAsset,
  convertedFileOf: (output: string) => ConvertedFile,
): SourceSlice {
  if (asset.path === "reencode") {
    const output = asset.output ?? fail("reencodeにoutputが無い");
    const file = convertedFileOf(output);
    return {
      sourceArchive: file.archive,
      sourceFileIndex: asset.sourceFileIndex,
      sourceOffset: 0,
      sourceSize: file.size,
    };
  }
  return {
    sourceArchive: asset.sourceArchive,
    sourceFileIndex: asset.sourceFileIndex,
    sourceOffset: asset.sourceOffset,
    sourceSize: asset.sourceSize,
  };
}
