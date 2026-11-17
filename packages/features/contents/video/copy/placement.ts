// 変換せずに写す映像の鍵・ファイル名と、manifestの参照の付け替え。副作用は持たない。
// 世代・アーカイブ名・位置・大きさがすべて同じ映像は、同じファイルを指す。

import {
  assetGenerationOf,
  type AssetKind,
  type ConversionPath,
  generatedSourceArchive,
  type IndividualAssetManifest,
  parseGeneratedSource,
  type SourceSlice,
} from "@csa/core";

/** 周回で書いた1世代分。キーは`copyKey` */
export interface CopyLap {
  files: Map<string, { path: string; size: number }>;
  generation: string;
  /** `files`のうち、前のビルドで写したファイルを使い回した数 */
  reused: number;
}

/** 素材の資産のうち、写すかどうかの判定と書き出しに使う欄 */
export interface CopyAsset extends SourceSlice {
  kind: AssetKind;
  path: ConversionPath;
}

type Slice = Pick<SourceSlice, "sourceArchive" | "sourceOffset" | "sourceSize">;

/** 同じ映像かどうかを判定するキーを作る。アーカイブ名の大文字と小文字は、配置計画のキーと同様に区別する */
export const copyKey = (slice: Slice): string =>
  [slice.sourceArchive, slice.sourceOffset, slice.sourceSize].join("|");

const safeName = (text: string): string =>
  text.replace(/[^A-Za-z0-9._-]/g, "_");

/** `discsDirectory`は、周回の成果物を世代ごとに置く場所 */
export const copyPathOf = (
  discsDirectory: string,
  generation: string,
  slice: Slice,
): string =>
  `${discsDirectory}/${generation}/video_copy/${
    safeName(slice.sourceArchive)
  }_${slice.sourceOffset}_${slice.sourceSize}.bin`;

/** 素材の資産のうち、そのまま写す映像 */
export const copiedVideosOf = <T extends CopyAsset>(
  assets: readonly T[],
): T[] =>
  assets.filter((asset) => asset.kind === "video" && asset.path === "copy");

export interface PlacedCopies<
  M extends IndividualAssetManifest = IndividualAssetManifest,
> {
  manifest: M;
  /** 最終の選曲が使わない映像のファイル */
  unused: string[];
  /** 最終の選曲が使う映像のファイルの数 */
  used: number;
}

/** 原盤を指す資産を、周回で書いたファイルへ向け直す。ファイルは消さない */
export function placeCopiedVideos<M extends IndividualAssetManifest>(
  source: M,
  laps: ReadonlyMap<string, CopyLap>,
): PlacedCopies<M> {
  const manifest = structuredClone(source);
  const used = new Set<string>();
  for (const song of manifest.songs) {
    for (const asset of song.assets) {
      if (parseGeneratedSource(asset.sourceArchive) !== null) {
        continue;
      }
      const generation = assetGenerationOf(song, asset);
      const found = laps.get(generation)?.files.get(copyKey(asset));
      if (found === undefined) {
        throw new Error(
          `${song.title}の映像が、${generation}の周回で書かれていない: ` +
            copyKey(asset),
        );
      }
      asset.sourceArchive = generatedSourceArchive("file", found.path);
      asset.sourceOffset = 0;
      asset.sourceSize = found.size;
      used.add(found.path);
    }
  }
  const unused = [...laps.values()]
    .flatMap((lap) => [...lap.files.values()].map(({ path }) => path))
    .filter((path) => !used.has(path));
  return { manifest, unused, used: used.size };
}

/** 実行の記録に書く、写した映像の本数の行 */
export const copiedVideoLine = (used: number, unused: number): string =>
  `copied videos: used ${used} / unused ${unused}`;
