// ISOの書き出しと読み戻しが受け取る入力。配置計画の型は持たず、使う欄だけを宣言する。
// 計画から欄を取り出すのは呼び出し側である。

import type { AssetSourceMap } from "./asset_sources.ts";

/** ISOへ書く実体。素材の範囲をそのまま写す */
export interface AssetPlacement {
  lba: number;
  newAbcIndex: number;
  sourceArchive: string;
  sourceGeneration: string;
  sourceOffset: number;
  sourceSize: number;
}

/** DATA1へ追記する`.if`1本。素材の範囲をそのまま写す */
export interface Data1CopiedFile {
  lba: number;
  newData1Index: number;
  sourceArchive: string;
  sourceGeneration: string;
  sourceOffset: number;
  sourceSize: number;
}

/** 中間ファイルに書いた画像セットの配置 */
export interface ImageSetPlacement {
  data1Index: number;
  lba: number;
  path: string;
  size: number;
}

export interface ImagePlan {
  /** 原盤のボリューム終端から連ねた新規資産の範囲 */
  assetRange: { endLba: number; startLba: number };
  /** 新規資産のうち、連ねたもの。原盤の空いた領域へ置くものは含まない */
  appended: readonly AssetPlacement[];
  data1: {
    /** 曲名カードの後ろにオーバーレイを並べた順 */
    copiedFiles: readonly Data1CopiedFile[];
    endLba: number;
    imageSets: readonly ImageSetPlacement[];
    overlayPackageCount: number;
    startLba: number;
    titleCardCount: number;
  };
  /** ISOへ実際に書く実体の全件 */
  placements: readonly AssetPlacement[];
  /** 新規資産のうち、原盤の空いた領域へ置くもの */
  reused: readonly AssetPlacement[];
}

/** 原盤領域の差し替え。複製の後に書く。`expected`が原盤と一致しなければ書かない */
export interface SourcePatchRange {
  expected: Uint8Array;
  name: string;
  offset: number;
  replacement: Uint8Array;
}

export interface ImageInput {
  assetSources: AssetSourceMap;
  elfBytes: Uint8Array;
  elfPlacement: { lba: number; volumeSectors: number };
  outputPath: string;
  plan: ImagePlan;
  sourcePatches: readonly SourcePatchRange[];
  sourceVolumeSectors: number;
}
