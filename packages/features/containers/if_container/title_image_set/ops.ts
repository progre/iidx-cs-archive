// 共有画像セットの`.if`を読み、spriteを合成し、分けて書く操作。
// 何をどこへ足すかは、呼び出し側が決める。

import {
  type DescriptorStart,
  type IfPackage,
  type Image,
  INTERMEDIATE_DIRECTORY,
  type OpenDisc,
} from "@csa/core";
import {
  extractSprites,
  READ_BUFFER_BYTES,
  readExtractedSprites,
  splitImageSet,
  writeExtractedSprites,
} from "../image_set/sprites/mod.ts";
import { writeImageSetFile } from "../image_set/mod.ts";
import {
  mergeExtractedSprites,
  mergePackedImages,
  silverReferenceOf,
} from "../image_set/merge/mod.ts";
import {
  type ByteReader,
  pbReader,
  readImageSet,
  sourceReader,
  type TocRowOf,
} from "./data1_reader.ts";
import { type IndexSheet, packImages } from "./pack_images.ts";

/** 合成した画像セットを書く場所 */
const IMAGE_SET_DIRECTORY = `${INTERMEDIATE_DIRECTORY}/iso/image_sets`;

/** 1ファイルのsheet上限。ローダーの上限は32。超えた分は追加ファイルへ分ける。圧縮後の大きさでも分ける */
const IMAGE_SET_SHEET_LIMIT = 32;

export interface ImageSetOpsDeps {
  indexSheet: IndexSheet;
  /** 原盤のELFにあるDATA1 TOCの位置 */
  pbTocFileOffset: number;
  tocRowOf: TocRowOf;
}

/** 素材世代の表示の配置のうち、画像セットを読むのに使う項目 */
interface SourceSetLayout {
  data1TocFileOffset: number;
  descriptorStart: DescriptorStart;
}

export function imageSetOps(deps: ImageSetOpsDeps) {
  return {
    /** spriteを切り出して、ファイルへ書く */
    extractSpritesToFile: (
      imageSet: IfPackage,
      sprites: readonly number[],
      path: string,
    ) => writeExtractedSprites(path, extractSprites(imageSet, sprites)),
    /** 全曲リストの文字を描いた絵を足す */
    mergeDrawnImages: (imageSet: IfPackage, images: Image[]) =>
      mergePackedImages(imageSet, packImages(deps.indexSheet, images)),
    /** 周回で取り出したspriteを足す */
    mergeSpriteFile: (
      imageSet: IfPackage,
      path: string,
      needed: number[],
      silver: number[] | null,
    ) =>
      mergeExtractedSprites(
        imageSet,
        readExtractedSprites(path),
        needed,
        silver,
      ),
    /** PBの共有画像セットを、原盤のELFのTOCから引いて読む */
    readPbImageSet: (
      pb: ByteReader,
      pbData1Lba: number,
      pbElf: Uint8Array,
      index: number,
    ) =>
      readImageSet(
        pbReader(
          { fileOffset: deps.pbTocFileOffset, rowOf: deps.tocRowOf },
          pb,
          pbData1Lba,
          pbElf,
        ),
        index,
      ),
    silverReferenceOf,
    /** 素材世代の原盤から画像セットを読む関数を作る */
    sourceImageSetReader: (
      generation: string,
      disc: OpenDisc,
      elf: Uint8Array,
      layout: SourceSetLayout,
    ) => {
      const data1 = disc.files.get("DATA1.DAT");
      if (data1 === undefined) {
        throw new Error(`${generation}にDATA1.DATが無い`);
      }
      const reader = sourceReader(
        deps.tocRowOf,
        disc.disc,
        data1.lba,
        elf,
        layout,
      );
      return (index: number) => readImageSet(reader, index);
    },
    /** ローダーの上限に合わせて分ける */
    splitImageSet: (imageSet: IfPackage) =>
      splitImageSet(imageSet, {
        byteLimit: READ_BUFFER_BYTES,
        sheetLimit: IMAGE_SET_SHEET_LIMIT,
      }),
    writeImageSetFile: (data1Index: number, bytes: Uint8Array) =>
      writeImageSetFile(IMAGE_SET_DIRECTORY, data1Index, bytes),
  };
}
