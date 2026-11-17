// 配置器へ渡す画像セットをまとめて作る。曲名の共有画像セットと、フォルダー名の画像セットである。
// spriteは周回で取り出してあるので、写し元の原盤を開かず、PBの画像セットへ合成する。

import {
  COPIES,
  FOLDER_NAME_GENERATION,
  folderNameFile,
  folderNameImage,
  type FolderNameKind,
  hasFolderNameSource,
  TARGET_SET,
} from "../folder_name.ts";
import type { ImageSetPorts, ImageSetTypes } from "./ports.ts";
import {
  buildTitleImageSets,
  type ImageSetFileResult,
  type TitleImageSetInput,
  type TitleImageSetResult,
} from "./title_sets.ts";

export type FolderNameImageValues = Record<FolderNameKind, number>;

export interface ImageSetBuild extends TitleImageSetResult {
  /** 追加フォルダーの名前の画像。写し元が収録に無ければ無い */
  folderNames?: FolderNameImageValues;
}

/** 写し元の世代が収録に無ければ、名前の画像を足さない */
async function buildFolderNameSet<T extends ImageSetTypes>(
  { ops }: ImageSetPorts<T>,
  input: TitleImageSetInput<T>,
): Promise<
  { file: ImageSetFileResult; images: FolderNameImageValues } | undefined
> {
  if (!hasFolderNameSource(input.manifest)) {
    return undefined;
  }
  const lap = input.lapOf(FOLDER_NAME_GENERATION);
  let target: T["package"] = await ops.readPbImageSet(
    input.pb,
    input.pbData1Lba,
    input.pbElf,
    TARGET_SET,
  );
  let bytes: T["part"] | undefined;
  const summaries: string[] = [];
  const images: Partial<FolderNameImageValues> = {};
  for (const copy of COPIES) {
    const path = lap?.folderNameFiles[copy.kind];
    if (path === undefined) {
      throw new Error(
        `${FOLDER_NAME_GENERATION}の周回で${copy.kind}の名前を取り出していない`,
      );
    }
    const merged = ops.mergeSpriteFile(target, path, [copy.sprite], null);
    bytes = merged.bytes;
    target = merged.package;
    summaries.push(merged.summary);
    images[copy.kind] = folderNameImage(merged.spriteMap.get(copy.sprite)!);
  }
  if (bytes === undefined) {
    throw new Error("写すフォルダー名の画像が無い");
  }
  const file = folderNameFile(bytes, summaries);
  return {
    file: {
      ...ops.writeImageSetFile(file.data1Index, file.bytes),
      summary: file.summary,
    },
    images: images as FolderNameImageValues,
  };
}

export async function buildImageSets<T extends ImageSetTypes>(
  ports: ImageSetPorts<T>,
  input: TitleImageSetInput<T>,
): Promise<ImageSetBuild> {
  const titles = await buildTitleImageSets(ports, input);
  const folderNames = await buildFolderNameSet(ports, input);
  if (folderNames === undefined) {
    return titles;
  }
  return {
    ...titles,
    files: [...titles.files, folderNames.file],
    folderNames: folderNames.images,
  };
}
