// 画像セットの組み立てに使うものを、世代の周回中にその世代の原盤から読んでおく。
// 組み立ては周回の後に行い、そのときは原盤を開かない。小さな表はメモリーに持ち、spriteの画素はファイルに書く。
// 周回では、候補の曲が使うspriteをすべて書く。最終的な選曲に合わせた絞り込みは、周回の後の組み立てで行う。

import type {
  CatalogRow,
  DisplaySong,
  ImageSetKind,
  TitleSpriteRef,
} from "@csa/core";
import {
  COPIES,
  FOLDER_NAME_GENERATION,
  type FolderNameKind,
} from "../folder_name.ts";
import { PB_IMAGE_SETS } from "../title/mod.ts";
import type { ImageSetPorts, ImageSetTypes } from "./ports.ts";

/** 周回で読んだ、画像セットの組み立てが要るもの */
export interface ImageSetLap {
  /** 曲DBの曲番号 → 全曲リストの行 */
  catalogRows: Map<number, CatalogRow>;
  /** フォルダー名の画像のspriteを取り出したファイル。写し元の世代だけが持つ */
  folderNameFiles: Partial<Record<FolderNameKind, string>>;
  /** 素材の曲DBエントリの曲名sprite参照。キーは素材の曲番号。曲名カードの無い世代は空 */
  sourceRefs: ReadonlyMap<number, TitleSpriteRef[]>;
  /** 共有画像セットごとに、曲名spriteを取り出したファイル */
  titleFiles: Partial<Record<ImageSetKind, string>>;
}

export interface ImageSetLapInput<T extends ImageSetTypes> {
  disc: T["disc"];
  elf: T["elf"];
  generation: string;
  /** 周回の成果物を世代ごとに置く場所。取り出したspriteは、その下の`<世代>/sprites/`へ書く */
  discsDirectory: string;
  /** その世代の収録の候補 */
  songs: readonly DisplaySong[];
}

const EMPTY = (): ImageSetLap => ({
  catalogRows: new Map(),
  folderNameFiles: {},
  sourceRefs: new Map(),
  titleFiles: {},
});

export async function readImageSetLap<T extends ImageSetTypes>(
  ports: ImageSetPorts<T>,
  { disc, elf, generation, songs, discsDirectory }: ImageSetLapInput<T>,
): Promise<ImageSetLap> {
  if (songs.length === 0) {
    return EMPTY();
  }
  const catalogRows = ports.catalogRowsOf(generation, elf);
  if (!ports.hasDisplayAssets(generation)) {
    return { ...EMPTY(), catalogRows };
  }
  const layout = ports.displayLayout(generation);
  const read = ports.ops.sourceImageSetReader(generation, disc, elf, layout);
  const sourceRefs = new Map(
    songs.filter((song) => song.titleCard !== undefined).map((song) => [
      song.sourceSongIndex,
      ports.sourceTitleRefsOf(generation, elf, song.sourceSongIndex),
    ]),
  );
  const refs = [...sourceRefs.values()].flat();
  const titleFiles: ImageSetLap["titleFiles"] = {};
  for (const { kind } of PB_IMAGE_SETS) {
    const sourceIndex = layout.imageSet[kind];
    const sprites = refs
      .filter((ref) => ref.fileIndex === sourceIndex)
      .map((ref) => ref.sprite);
    if (sprites.length === 0) {
      continue;
    }
    const path = `${discsDirectory}/${generation}/sprites/${kind}.bin`;
    ports.ops.extractSpritesToFile(await read(sourceIndex), sprites, path);
    titleFiles[kind] = path;
  }
  const folderNameFiles: ImageSetLap["folderNameFiles"] = {};
  if (generation === FOLDER_NAME_GENERATION) {
    for (const copy of COPIES) {
      const path =
        `${discsDirectory}/${generation}/sprites/folder_${copy.kind}.bin`;
      ports.ops.extractSpritesToFile(
        await read(copy.sourceSet),
        [copy.sprite],
        path,
      );
      folderNameFiles[copy.kind] = path;
    }
  }
  return { catalogRows, folderNameFiles, sourceRefs, titleFiles };
}
