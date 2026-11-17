/**
 * CSAのELFを作る関数の入力。ELFへ書く値だけを持ち、素材のパスも表示する曲名も持たない。
 */

import type { FieldWidth, ManifestVariant } from "@csa/core";
import type { SaveDataReference } from "../code/instructions/save/mod.ts";
import type { SongValueSite } from "../code/instructions/song_value/mod.ts";
import type { DirectGroup } from "../code/selector_work/allowlist/mod.ts";
import type { EntryFormat } from "../data/content/mod.ts";

/** 曲DB`+0x64`(読み込む一覧)と`+0x74`(組)へ重ねるバイト列。 */
export interface OverlayFields {
  packages: Uint8Array;
  pairs: Uint8Array;
}

/** 曲DB`+0xAC`〜`+0xB8`の1組。`fileIndex`は画像セットのDATA1 index。 */
export interface TitleSprite {
  fileIndex: number;
  sprite: number;
}

/** 曲DBの資産参照欄1つ。 */
export interface AbcReference {
  fieldOffset: number;
  newAbcIndex: number;
  width: FieldWidth;
}

/** 曲DBの枠1つぶんの収録内容。 */
export interface SongEntry {
  abcReferences: AbcReference[];
  /** 表の曲の中で譜面を移す組。移し先 → 移し元の難易度名 */
  movedCharts?: Record<string, string>;
  /** 曲DBエントリー1件ぶんのバイト列。 */
  entry: Uint8Array;
  /** `entry`のうち曲DBへ書く範囲。残りは複製元の値を残す。 */
  entryRanges: [number, number][];
  /** 5鍵盤版なら、レベル欄の写し元になる表の曲の枠。 */
  fiveKeyFrontIndex?: number;
  /** 5鍵盤版が、表の曲のレベルを写さず自分のレベルを使うなら`true` */
  fiveKeyOwnLevels?: true;
  overlayFields: OverlayFields;
  /** オーバーレイをANOTHERのときだけ使う。演奏中に難易度を見て切り替える */
  overlayOnlyAnother?: boolean;
  targetSongIndex: number;
  titleSprites?: TitleSprite[];
  variantOf?: ManifestVariant;
  /** 共有動画を書く曲DBの欄。個別動画を置く構成では空になる。 */
  videoFields: number[];
}

/** 組を持たない曲の記述子1件 */
export interface PairlessSong {
  /** 0x140バイト。DATA1 indexは振り直し済み。 */
  descriptor: Uint8Array;
  packageIndex: number;
  songIndex: number;
}

/** PBの曲DBのムービー欄を別のABC indexへ向ける1件 */
export interface PbVideoField {
  abcIndex: number;
  /** 曲DB`+0x62`の下位2bit */
  flags: number;
  songIndex: number;
}

/** PB原盤の曲のレベル欄(`+0x4a`の10バイト)を書き換える値 */
export interface PbLevelField {
  levels: Uint8Array;
  songIndex: number;
}

/** PB原盤の曲の作品番号を、原盤の値でなく全曲リストの`folder`で決める1件 */
export interface PbVersionField {
  songIndex: number;
  version: number;
}

/** PB 原盤の曲の写しの裏。表を書く前の`songId`の枠のエントリーを、`targetSongIndex`の枠へ写す */
export interface PbBackEntry {
  /** 表の曲が持たない難易度を鳴らす裏なら`true` */
  forcedBack?: true;
  /** 表の曲が持たない難易度 → それを出すこの裏の難易度 */
  frontCharts?: Record<string, string>;
  position: number;
  songId: number;
  targetSongIndex: number;
}

export interface SongContent {
  pairlessSongs?: PairlessSong[];
  pbBacks?: PbBackEntry[];
  pbLevels?: PbLevelField[];
  pbVersions?: PbVersionField[];
  pbVideos?: PbVideoField[];
  sharedVideoAbcIndex?: number;
  songs: SongEntry[];
}

/** DATA1へ追記する1本。`relativeSector`はDATA1先頭からの距離。 */
export interface Data1Row {
  lba: number;
  newData1Index: number;
  relativeSector: number;
  sectors: number;
}

/** 曲DB`+0x98`の1組。`titleCard`が0の枠は空。 */
export interface TitleCardPair {
  animation: number;
  titleCard: number;
}

/** ABC表へ新しく書く1行。 */
export interface AbcEntry {
  lba: number;
  newAbcIndex: number;
  sectors: number;
  sourceSize: number;
}

/** 曲名カード1本と、それを指す曲。 */
export interface TitleCardRow extends Data1Row {
  pairs: TitleCardPair[];
  targetSongIndices: number[];
}

/** フォルダー名の画像。どちらも`DATA1番号 << 16 | sprite` */
export interface FolderNameImages {
  /** カーソルを合わせたときの大きな名前 */
  big: number;
  /** 一覧の項目の名前 */
  label: number;
}

/** 資産の配置。ELFへ書く数値だけを持ち、実体のバイト列は持たない。 */
export interface AssetPlacement {
  abcEntries: AbcEntry[];
  /** 追加フォルダーの名前の画像。無ければ原盤の画像で代える */
  addedFolderNames?: FolderNameImages;
  /** DATA1の先頭LBA。相対セクタとLBAの照合に使う。 */
  data1BaseLba: number;
  imageSets: Data1Row[];
  overlayPackages: Data1Row[];
  titleCards: TitleCardRow[];
}

/** 曲数から決まる値。算出は`capacity.ts`が持つ。 */
export interface SongCapacity {
  /** 移設するABC表の確保件数 */
  abcCapacity: number;
  /** 候補曲indexリストの確保バイト数 */
  candidateListBytes: number;
  /** DATA1のポインタ表とTOCの確保件数 */
  data1Capacity: number;
  /** 項目配列の容量 */
  itemCapacity: number;
  /** 選曲recordの長さ */
  recordSize: number;
  /** 選曲recordの容量 */
  records: number;
  /** セーブ側の曲容量 */
  saveCapacity: number;
  /** 選べる曲数。原盤の99を含む */
  songCount: number;
  /** 曲DBの確保件数 */
  songDbCapacity: number;
}

/** 解析で分類した命令の一覧。`code/instructions/tables.ts`が`data/`から読む。 */
export interface ElfPatchTables {
  saveDataReferences: readonly SaveDataReference[];
  selectionItemLbu: readonly number[];
  /** 選曲ワークを触る命令の許可一覧 */
  selectorWorkDirect: readonly DirectGroup[];
  songCountImmediates: readonly number[];
  songValueSites: readonly SongValueSite[];
}

export interface CsaElfInput {
  capacity: SongCapacity;
  content: SongContent;
  /** 曲DBエントリーの形。PBの定義から引く */
  entryFormat: EntryFormat;
  placement: AssetPlacement;
}
