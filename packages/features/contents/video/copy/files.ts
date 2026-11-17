// 変換せずに写す映像を、周回で1本ずつファイルに書く。
// 周回では最終の選曲が決まらないので、表の全行の`copy`を書く。
// ファイル名は原盤の中の場所と大きさから決まり、原盤は変わらない。
// そのため、同じ名前と大きさのファイルが前のビルドから残っていれば、写し直さずに使う。

import { type OpenDisc, SEC } from "@csa/core";
import { fileSizeOf, resetDirectory, writeCopyFile } from "./copy_gateway.ts";
import {
  copiedVideosOf,
  type CopyAsset,
  copyKey,
  type CopyLap,
  copyPathOf,
} from "./placement.ts";

/**
 * 世代の映像を、開いてある原盤から読んで1本ずつ書く。同じ鍵は1回だけ書く。
 * `reuse`が偽なら、置き場を空にしてからすべて写す
 */
export async function writeCopiedVideos<T extends CopyAsset>(
  { disc, files }: OpenDisc,
  generation: string,
  assets: readonly T[],
  discsDirectory: string,
  reuse: boolean,
): Promise<CopyLap> {
  const readAsset = async (asset: T) => {
    const archive = files.get(asset.sourceArchive.toUpperCase().split(";")[0]);
    if (archive === undefined) {
      throw new Error(`source ISOに${asset.sourceArchive}が無い`);
    }
    return await disc.readAt(
      archive.lba * SEC + asset.sourceOffset,
      asset.sourceSize,
    );
  };
  if (!reuse) {
    resetDirectory(`${discsDirectory}/${generation}/video_copy`);
  }
  const written = new Map<string, { path: string; size: number }>();
  let reused = 0;
  const videos = [...Map.groupBy(copiedVideosOf(assets), copyKey)];
  for (const [index, [key, [asset]]] of videos.entries()) {
    console.log(`${index + 1}/${videos.length} ${generation} video`);
    const path = copyPathOf(discsDirectory, generation, asset);
    if (reuse && fileSizeOf(path) === asset.sourceSize) {
      reused++;
    } else {
      writeCopyFile(path, await readAsset(asset));
    }
    written.set(key, { path, size: asset.sourceSize });
  }
  return { files: written, generation, reused };
}
