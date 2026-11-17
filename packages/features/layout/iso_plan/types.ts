// 配置計画(`createPlacementPlan`の出力)が使う型。manifestの入力形式は`../types.ts`。

import type {
  ManifestAsset,
  SourceSlice,
  TitleCardPair,
  TitleSpriteRef,
} from "@csa/core";

/** 新規資産はA/B/Cに属さず、ABC表`+0`へタグ3付きの絶対LBAを書く */
export interface PlannedAsset extends ManifestAsset {
  lba: number;
  newAbcIndex: number;
  sectors: number;
  sourceGeneration: string;
  sourceSongIndex: number;
  targetSongIndex: number;
  title: string;
}

/** ISOへ書く実体。素材の同じ範囲を指す曲はこの1件を共有する */
export interface PlannedPlacement {
  lba: number;
  newAbcIndex: number;
  sectors: number;
  sourceArchive: string;
  sourceGeneration: string;
  sourceOffset: number;
  sourceSize: number;
}

/** イメージ上の連続範囲。`endLba`は含まない */
export interface PlannedRange {
  endLba: number;
  startLba: number;
}

/** DATA1へ追記する`.if`1本。同じsourceを指す曲はこの1件を共有する */
export interface PlannedData1File extends SourceSlice {
  lba: number;
  newData1Index: number;
  relativeSector: number;
  sectors: number;
  sourceGeneration: string;
}

export interface PlannedTitleCard extends PlannedData1File {
  /** 曲DB`+0x98`へ書く組。共有する曲の間で同じ */
  pairs: TitleCardPair[];
  targetSongIndices: number[];
}

/** 曲中オーバーレイのパッケージ。組は曲DB側に書くので共有の鍵に含めない */
export type PlannedOverlayPackage = PlannedData1File;

/** 合成して中間ファイルに書いた画像セット */
export interface ImageSetFile {
  data1Index: number;
  path: string;
  size: number;
}

/** 生成した共有画像セットの配置。原盤にあるDATA1 indexのTOC行は、この位置を指すように書き換える */
export interface PlannedImageSet extends ImageSetFile {
  lba: number;
  relativeSector: number;
  sectors: number;
}

export interface PlannedData1 {
  imageSets: PlannedImageSet[];
  baseLba: number;
  endLba: number;
  overlayPackages: PlannedOverlayPackage[];
  startLba: number;
  titleCards: PlannedTitleCard[];
}

export type { TitleSpriteRef };

export interface TitleImageSetBuild {
  /** legacyで4枠のどれかを作れず、空の絵を指す曲 */
  legacyIncomplete: string[];
  files: (ImageSetFile & { summary: string })[];
  /** target song index → 4画像セットのsprite参照 */
  songSprites: Map<number, TitleSpriteRef[]>;
}

export interface PlacementPlan {
  abcCapacity: number;
  /** 原盤のボリューム終端から連ねた新規資産の範囲。原盤の空いた領域へ置いたものは含まない */
  assetRange: PlannedRange;
  assets: PlannedAsset[];
  data1: PlannedData1;
  /** ISOへ実際に書く実体。`assets`の重複を落としたもの。原盤の空いた領域へ置くものも含む */
  placements: PlannedPlacement[];
  /** どの曲も指さなくなった原盤の領域。`placements`の一部をここへ置く */
  reusedRanges: PlannedRange[];
  targetSongCount: number;
  /** DATA1追記の終端。ELFはこの後ろへ置く */
  totalSectors: number;
}
