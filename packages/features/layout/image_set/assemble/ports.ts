// 画像セットの組み立てが使う、他の feature の操作。実装は app が渡す。
// `.if`の中身は読まず、受け取った値をそのまま次の操作へ渡す。

import type {
  CatalogRow,
  DescriptorStart,
  Image,
  ImageSetKind,
  TitleSpriteRef,
} from "@csa/core";

/** 組み立てが中身を読まずに次の操作へ渡す値の型。実際の型は app が決める */
export interface ImageSetTypes {
  disc: unknown;
  elf: unknown;
  package: unknown;
  part: unknown;
  pb: unknown;
}

/** 素材世代の表示の配置のうち、組み立てに使う項目 */
export interface SourceDisplayLayout {
  data1TocFileOffset: number;
  descriptorStart: DescriptorStart;
  imageSet: Record<ImageSetKind, number>;
}

/** spriteを足した結果 */
interface MergedSprites<T extends ImageSetTypes> {
  bytes: T["part"];
  package: T["package"];
  spriteMap: ReadonlyMap<number, number>;
  summary: string;
}

export interface ImageSetOps<T extends ImageSetTypes> {
  extractSpritesToFile: (
    imageSet: T["package"],
    sprites: readonly number[],
    path: string,
  ) => void;
  mergeDrawnImages: (imageSet: T["package"], images: Image[]) => {
    package: T["package"];
    spriteIndices: readonly number[];
    summary: string;
  };
  mergeSpriteFile: (
    imageSet: T["package"],
    path: string,
    needed: number[],
    silver: number[] | null,
  ) => MergedSprites<T>;
  readPbImageSet: (
    pb: T["pb"],
    pbData1Lba: number,
    pbElf: T["elf"],
    index: number,
  ) => Promise<T["package"]>;
  silverReferenceOf: (imageSet: T["package"]) => number[];
  sourceImageSetReader: (
    generation: string,
    disc: T["disc"],
    elf: T["elf"],
    layout: SourceDisplayLayout,
  ) => (index: number) => Promise<T["package"]>;
  splitImageSet: (imageSet: T["package"]) => {
    parts: T["part"][];
    spriteMap: ReadonlyMap<number, { part: number; sprite: number }>;
  };
  writeImageSetFile: (
    data1Index: number,
    bytes: T["part"],
  ) => { data1Index: number; path: string; size: number };
}

export interface ImageSetPorts<T extends ImageSetTypes> {
  catalogRowAt: (
    generation: string,
    line: number | undefined,
  ) => CatalogRow | undefined;
  catalogRowsOf: (
    generation: string,
    elf: T["elf"],
  ) => Map<number, CatalogRow>;
  displayLayout: (generation: string) => SourceDisplayLayout;
  hasDisplayAssets: (generation: string) => boolean;
  ops: ImageSetOps<T>;
  /** 文字の見た目を読み、文字を描く関数を返す */
  openTextRenderer: Parameters<
    typeof import("../catalog/mod.ts").catalogImages
  >[0]["openTextRenderer"];
  /** 原盤のDATA1 TOCの件数。新規のDATA1 indexは、この次から採番する */
  pbTocCount: number;
  /** 素材の曲DBエントリの曲名sprite参照を読む */
  sourceTitleRefsOf: (
    generation: string,
    elf: T["elf"],
    songIndex: number,
  ) => TitleSpriteRef[];
}
