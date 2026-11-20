// 収録内容(どの素材をどの枠へ載せるか)の形式。配置計画の出力形式は別に持つ。

import type {
  FreedPbFile,
  ManifestPbBack,
  PbLevels,
  PbVersion,
  PbVideoRedirect,
} from "./pb_fields.ts";
import type { ManifestOverlay, ManifestTitleCard } from "./song_display.ts";

export type AssetKind = "bgm" | "chart" | "keysound" | "video";

/**
 * 演奏中に裏のエントリーへ切り替える条件。
 * - `alternate`: 演奏ごとに交互に切り替える。
 * - `always`: 条件を満たす限り、常に切り替える。
 * - `previousSong`: 直前に決まった曲を演奏していたときに切り替える。
 * - `random7`/`random8`: 乱数で切り替える。
 * - `custom`: 全曲リストで表の曲を書いた裏。表の曲1曲に4曲まで付き、SELECT と一緒に押すボタンか乱数で選ぶ。
 *
 * `custom`のほかは、原作の実装と同じ区分である。
 */
export type SwitchRule =
  | "alternate"
  | "always"
  | "custom"
  | "previousSong"
  | "random7"
  | "random8";

export type FieldWidth = "u16" | "u32";

export interface AssetReference {
  fieldOffset: number;
  width: FieldWidth;
}

/** 素材アーカイブ内の1本。ISOへはこの範囲をそのまま写す */
export interface SourceSlice {
  sourceArchive: string;
  sourceFileIndex: number;
  sourceOffset: number;
  sourceSize: number;
}

export interface ManifestAsset extends SourceSlice {
  kind: AssetKind;
  references: AssetReference[];
  /** 曲と別の世代の素材を使うときだけ持つ。同じ内容のムービーを1本に揃えた曲 */
  sourceGeneration?: string;
}

/** 資産を読む素材世代 */
export const assetGenerationOf = (
  song: { sourceGeneration: string },
  asset: { sourceGeneration?: string },
): string => asset.sourceGeneration ?? song.sourceGeneration;

/**
 * 選曲できない裏エントリーの差し替え元。`targetSongIndex`は表の曲の枠で、
 * 演奏中のBGM差し替えの条件が`rule`
 */
export interface ManifestVariant {
  /** `previousSong`で、直前に演奏していると切り替わる曲の枠。選外なら持たない */
  afterTargetSongIndex?: number;
  /**
   * `custom`で、表の曲が持たない難易度を鳴らす裏なら`true`。表の曲ごとに1曲まで。
   * 印の無い表の曲では、その難易度を持つ候補の先頭の裏が鳴る
   */
  forcedBack?: true;
  /**
   * `custom`で、裏の曲の中で譜面を移す組。移し先の難易度 → 移し元の難易度で、`sp_black`の形。
   * 全曲リストの`chart_moves`と、表の曲が持たない難易度を埋めるためにビルドが足す組である
   */
  chartMoves?: Record<string, string>;
  /**
   * `chartMoves`の移し先のうち、表の曲が持たない難易度。
   * この組は、移し元を空にせず、移した譜面を表の曲へも写す
   */
  frontFills?: string[];
  /** `custom`で、同じ表の曲の裏の中での番号。古い世代から順に0から振り、usは最後にする */
  position?: number;
  rule: SwitchRule;
  targetSongIndex: number;
}

/** 5鍵盤版の表の曲。`targetSongIndex`は表の枠 */
export interface ManifestFiveKey {
  /** 全曲リストで書いた組なら`true`。5鍵盤版は、表の曲のレベルを写さず、自分のレベルを使う */
  ownLevels?: true;
  targetSongIndex: number;
}

/** 補正で変わった値の、補正前の値。補正で変わらなかった値は持たない */
export interface ManifestUncorrected {
  /** 全曲リストの難易度と SP BEGINNER の上限をかける前のレベル。キーは難易度名 */
  levels?: Record<string, number>;
  /** 全曲リストの`folder`列が無ければ規則が決める作品番号。規則で決まらなければ`null` */
  version?: number | null;
  /**
   * 原作のムービー。共有BGAへ向けた曲と、同じ映像の1本へムービーを差し替えた曲だけが持つ。
   * `sourceFileIndex`はその世代のsongmapの通し番号
   */
  videos?: { sourceFileIndex: number; sourceGeneration: string }[];
}

export interface ManifestSong {
  assets: ManifestAsset[];
  canonicalKey: string;
  /** 全曲リストでこの曲を書いた行の番号。同じ曲を2行に書いた曲では、行ごとに違う */
  catalogLine?: number;
  /** 表の曲の中で譜面を移す組。移し先 → 移し元の難易度名。全曲リストの表の曲の行の`chart_moves` */
  chartMoves?: Record<string, string>;
  /**
   * PB形式の曲DBエントリ(0x134バイト、base64)。参照欄は配置器が新indexへ置き換える。
   * `excludedCharts`の譜面も、レベルとノーツ数を残す
   */
  entry: string;
  /** 全曲リストで`x`を書いた、収録しない譜面の難易度名。曲DBへ書くときに欄を消す */
  excludedCharts?: string[];
  /** 5鍵盤版の曲が持つ。選曲リストに出る7鍵盤版の曲を指し、レベル欄の値はその曲から写す */
  fiveKeyOf?: ManifestFiveKey;
  /** 全曲リストの`note`。曲リストに出す */
  note?: string;
  /** 演奏画面のレイヤー。持たない曲は追加曲でも全枠を空にする */
  overlay?: ManifestOverlay;
  /** オーバーレイをANOTHERのときだけ使う。PBのELFが演奏中に難易度を見て切り替える */
  overlayOnlyAnother?: true;
  /**
   * 音とオーバーレイを共有するPB原盤の曲。曲DBの音の欄はその曲のABC indexを持ち、
   * オーバーレイの欄はその曲の値を写す
   */
  sharedWith?: { targetSongIndex: number };
  /** 3段組が帯に分かれず表示資産を作れない曲はクローン元の表示のまま置く */
  titleCard?: ManifestTitleCard;
  sourceGeneration: string;
  sourceSongIndex: number;
  targetSongIndex: number;
  title: string;
  /** 補正で変わった値の、補正前の値。曲リストが`補正前→補正後`の形で出す */
  uncorrected?: ManifestUncorrected;
  /** 選曲リストに出さない裏エントリーなら、差し替え元の曲と条件 */
  variantOf?: ManifestVariant;
  /** 共有動画を書き込む曲DBの欄。個別動画を置く構成では空になる */
  videoFields: number[];
}

/** manifestが使う素材世代 */
export interface ManifestSource {
  elf: string;
  /** `entry`のうち曲DBへ書く範囲(`song_db/entry/pb_entry.ts`)。残りはクローン元の値を残す */
  entryRanges: [number, number][];
  songmap: string;
}

export interface IndividualAssetManifest {
  expectedNewAbcCount: number;
  freedPbFiles?: FreedPbFile[];
  pbBacks?: ManifestPbBack[];
  /** PB原盤の曲に、全曲リストで書いた難易度。書いた曲だけを持つ */
  pbLevels?: PbLevels[];
  /** PB原盤の曲に、全曲リストで書いたフォルダー。書いた曲だけを持つ */
  pbVersions?: PbVersion[];
  pbVideoRedirects?: PbVideoRedirect[];
  /** 追加曲が共有するPBの動画ABC index。個別動画を置く構成では持たない */
  sharedVideoAbcIndex?: number;
  /** 世代名 → 素材仕様。曲の`sourceGeneration`で引く */
  sources: Record<string, ManifestSource>;
  targetSongCount: number;
  songs: ManifestSong[];
}
