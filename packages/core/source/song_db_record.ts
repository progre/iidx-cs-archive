/** offsetはレコード先頭からの位置 */
export interface Slots {
  offset: number;
  count: number;
}

/** 1つあたりのバイト数が世代で違う並び */
export interface SizedSlots {
  offset: number;
  count: number;
  bytes: number;
}

/** 1つしか持たず、バイト数が世代で違う値 */
export interface SingleSlot {
  offset: number;
  bytes: number;
}

export type TitleEncoding = "euc-jp" | "shift-jis";

/** 題名と完全な題名 */
export interface TitleLayout {
  offset: number;
  /**
   * 真ならoffsetにELFの仮想アドレス(u32)があり、その先がNUL終端の題名。
   * 偽ならoffsetから決まった大きさの枠に題名が埋め込まれている。
   */
  isElfPointer: boolean;
  /** 完全な題名を指すELFの仮想アドレス(u32)の位置。3rd〜8thのみ */
  fullOffset: number | null;
  /** 題名と完全な題名の文字コード。nullならASCIIの範囲に収まる */
  encoding: TitleEncoding | null;
  /** 題名の前に`<表示順> <内部番号>_`が付き、末尾に空白が残ることがある */
  hasIndexPrefix: boolean;
}

/** BPM(u16)。PB形式の世代のみ */
export interface BpmLayout {
  minOffset: number;
  /** 単一BPMの曲は0xFFFF */
  maxOffset: number;
  /** 先頭BPM。先頭であることは暫定 */
  firstOffset: number;
}

/** 曲の出自を表す値。4thとusは持たない */
export interface SongOriginLayout {
  offset: number;
  /** 幅はdjt以降がu16、goldまでがu8 */
  bytes: number;
  /**
   * 真ならACの作品番号(8th〜pb)。
   * 偽なら新旧の印で、0が前作以前、1がその作品のAC新曲、2が隠し曲(3rd・5th〜7th)。
   */
  isVersion: boolean;
}

/** 選曲で使う値 */
export interface SelectionLayout {
  /**
   * 名前順OTHERSの印。9th以降のみが持つ。
   * 幅はdjt以降がu16、goldまでがu8
   */
  others: SingleSlot | null;
  bpm: BpmLayout | null;
  /** 連続した並びから外れたBEGINNERのレベル(u8)の位置。red〜goldのみ */
  beginnerLevelOffset: number | null;
  /** u8 */
  levels: Slots;
  origin: SongOriginLayout | null;
}

/**
 * ファイル番号の欄をファイル表で引く規則。nullなら全アーカイブの表をつないだ通し番号で引く。
 * origin: 出自が2の曲は2つ目のアーカイブ、他は1つ目で引く(6thのムービー)。
 * overlap: 2つ目のアーカイブの件数未満なら2つ目、以上なら3つ目で、同じ番号を引く(7th・8th)
 */
export type ArchiveRule = "origin" | "overlap";

export interface VideoLayout {
  /** 1本あたりのバイト数は3rd〜8thが2、9th以降が4 */
  primary: SizedSlots;
  /** 2本目の動画を1本目の続き番号で指す世代がある */
  derivesSecondary: boolean;
  archiveRule: ArchiveRule | null;
  /** 1本目と離れた位置にある2本目の動画。6th〜8thのみ */
  secondary: SizedSlots | null;
  /** 真なら、2本目は1本目が負(s16)の曲だけが使う。7thのみ */
  secondaryIsFallback: boolean;
  /**
   * ムービーを基準点(ロード画面を抜ける直前)の何フレーム前に出すか(s16)。
   * PB `+0x60` 相当で、9th以降のみ
   */
  movieLeadOffset: number | null;
  /**
   * PB `+0x62` 相当の欄(u8)の位置。9th以降のみ。
   * bit1は動画が480x480であることを表す。この値は動画そのものから分かる。
   * この欄を素材から読むのは、横引き伸ばしの印のbit0を写すためである。
   */
  unkPb62Offset: number | null;
  /** 2本目の動画をどのアーカイブから引くか(u16)。7thのみ */
  secondaryArchiveOffset: number | null;
  /**
   * ムービー開始から譜面の判定開始までのフレーム数から135を引いた値(s16)。
   * 3rd〜8thのみで、9th以降はmovieLeadOffsetを持つ
   */
  movieCountInOffset: number | null;
}

/** 曲名カードと選曲画面の絵 */
export interface ArtworkLayout {
  /** ジャンルのanimation(u16)の位置。4th〜8thのみ */
  genreOffset: number | null;
  /** 大きな曲名のanimation(u16)の位置。4th〜8thのみ */
  bigTitleOffset: number | null;
  /** アーティストのanimation(u16)の位置。6th〜8thのみ */
  artistOffset: number | null;
  /** 曲名カード。3rd〜8thはanimation(u16)、9th以降はDATA1 index(u32) */
  titleCard: SingleSlot;
  /** 曲名カードの`{u16 animation, u16 DATA1 index}`の組。9th以降のみ */
  titleCardPairs: Slots | null;
  /** 共有画像セットの`{u16 sprite, u16 DATA1 index}`の並び。9th以降のみ */
  imageSet: Slots | null;
  /** PB `+0xBC` の欄(u32)の位置。PB形式の世代のみ */
  unkPbBcOffset: number | null;
}

/** 譜面と音 */
export interface ChartLayout {
  /** u32。並びは譜面形式の難易度順で、SPとDPが交互になる */
  files: Slots;
  /** 譜面の値がELFの仮想アドレスなら真。偽ならファイル表の番号 */
  areElfPointers: boolean;
  /** キー音とBGM(u16)。組は`[0,2] [1,3] [4,6] [5,7] …` */
  sounds: Slots;
  /** ANOTHER専用のBGM(u16)の位置。3rdのみ。`sounds`の組に入らない */
  anotherBgmOffset: number | null;
  /** キー音のアーカイブ番号(u8)の位置。6th〜8thのみ。無い世代は、キー音の値がそのままfile indexである */
  keysoundArchiveOffset: number | null;
  /** ノーツ数(u16)。SPは総数、DPは1Pと2Pを別に持つ。PB形式の世代のみ */
  notes: Slots | null;
  /** PB `+0x126` の欄(u16)。難易度ごとの何かの量。PB形式の世代のみ */
  unkPb126: Slots | null;
}

/** 曲中オーバーレイ。3rd〜8thはslotsとfileOffset、9th以降はpackagesとpairsを持つ */
export interface OverlayLayout {
  /** 読み込むDATA1 index(u16)の一覧 */
  packages: Slots | null;
  /** `{u16 animation, u16 DATA1 index}`の組 */
  pairs: Slots | null;
  /** 先頭u16の種別が0の枠は使わない */
  slots: SizedSlots | null;
  /** 主アーカイブの`IFs`のファイル番号(u16)の位置。0xFFFFは持たない印 */
  fileOffset: number | null;
  archiveRule: ArchiveRule | null;
}

/** 曲DBレコードの中の位置。キーは定義のCSVの行の順 */
export interface SongDbRecordLayout {
  title: TitleLayout;
  selection: SelectionLayout;
  video: VideoLayout;
  artwork: ArtworkLayout;
  overlay: OverlayLayout;
  chart: ChartLayout;
}
