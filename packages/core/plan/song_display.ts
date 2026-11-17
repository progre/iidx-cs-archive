// 曲の表示資産(曲中オーバーレイと曲名カード)を、manifestでどう持つか。

import type { ManifestSong, SourceSlice } from "./manifest.ts";

// 曲中オーバーレイのパッケージを共有判定する鍵。分けた本は元の`sourceFileIndex`を
// 引き継ぐので、実体のありか(`sourceArchive`)まで含めないと別の本を同じ1件と見てしまう。
export type OverlaySource = Pick<
  SourceSlice,
  "sourceArchive" | "sourceFileIndex"
>;

export const overlayKey = (generation: string, item: OverlaySource): string =>
  `${generation}/${item.sourceArchive}/${item.sourceFileIndex}`;

/** 曲中オーバーレイの`.if`。曲DB`+0x64`の一覧が読み込む1本 */
export type ManifestOverlayPackage = SourceSlice;

export interface ManifestOverlayPair {
  animation: number;
  /** `packages`の添字 */
  packageIndex: number;
}

/** 曲DB+0x64/+0x74の曲中オーバーレイ。演奏画面で重ねるレイヤーを持つ */
export interface ManifestOverlay {
  /**
   * 曲の1拍の長さ。単位は frame(1/60秒)である。
   * 3rd〜8thのオーバーレイで、表示長が255の frame はこの長さに縮めて写す。
   * 表示長が255の frame を持たない曲は、この欄を持たない
   */
  holdFrames?: number;
  packages: ManifestOverlayPackage[];
  /** 枠の位置を保った組。空枠はnull */
  pairs: (ManifestOverlayPair | null)[];
}

export interface TitleCardPair {
  animation: number;
  /** 素材DATA1 index。0は未使用 */
  titleCard: number;
}

/** 曲DB+0x94の曲名カード `.if`。ジャンル・曲名・アーティストの表示画像を持つ */
export interface ManifestTitleCard extends SourceSlice {
  pairs: TitleCardPair[];
}

/**
 * 曲名カードとオーバーレイの準備が読む曲。
 * 曲DBエントリー・曲index・組の相手・共有・補正前の値は周回の後に決まるので、持たない
 */
export type DisplaySong = Omit<
  ManifestSong,
  | "entry"
  | "fiveKeyOf"
  | "sharedWith"
  | "targetSongIndex"
  | "uncorrected"
  | "variantOf"
>;

/** 上限を超える本と、それを指す曲の場面と残り枠 */
export interface OverLimitPackage {
  /** 分けてよい本数。曲の一覧の枠から他のパッケージのぶんを引いた残り */
  budget: number;
  generation: string;
  item: ManifestOverlayPackage;
  scenes: Set<number>;
}
