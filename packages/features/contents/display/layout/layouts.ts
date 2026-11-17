// 曲名表示資産(曲名カード`.if`と共有画像セット)を素材世代からPBへ移せる世代の配置。唯一の定義。
// 9th〜goldの値は総当たりとPB再収録曲で裏付けた。djt・empの値は個別資産の容量から求めた。
// 3rd〜8thは曲名カードも共有画像セットも持たないので載せない。
// これらの世代は3段組を切って組み立てる(`legacy/`)。
import type {
  DescriptorStart,
  ImageSetKind,
  PairlessSourceSong,
} from "@csa/core";

export interface DisplayLayout {
  /** 曲DBの画像セット欄が指す共有画像セットのDATA1 index */
  imageSet: Record<ImageSetKind, number>;
  /**
   * PBの4欄(ジャンル、大、アーティスト、小)に当たる素材側の枠番号。
   * 9th・10thは5枠で、4枠目が余り(10thは常に0、9thは10曲がアーティストの別sprite)
   */
  imageSetSlots: [number, number, number, number];
  /** ELF内DATA1 TOC `{id, sector, count, 0}`×16バイトの件数とファイルoffset */
  data1TocCount: number;
  data1TocFileOffset: number;
  descriptorStart: DescriptorStart;
}

/** 素材世代のDATA1アーカイブ名。ISO上の大文字小文字は世代で違うが、配置器は小文字で引く */
export const SOURCE_DATA1_ARCHIVE = "data1.dat";

const PB_SLOTS: [number, number, number, number] = [0, 1, 2, 3];
const FIVE_SLOTS: [number, number, number, number] = [0, 1, 2, 4];

const PB_LIKE = {
  imageSetSlots: PB_SLOTS,
  descriptorStart: 8,
} as const;

export const DISPLAY_LAYOUTS: Record<string, DisplayLayout> = {
  "10th": {
    imageSet: { artist: 165, big: 163, genre: 164, small: 162 },
    imageSetSlots: FIVE_SLOTS,
    data1TocCount: 283,
    data1TocFileOffset: 0xc8e08,
    descriptorStart: 4,
  },
  "red": {
    imageSet: { artist: 284, big: 282, genre: 283, small: 281 },
    imageSetSlots: PB_SLOTS,
    data1TocCount: 412,
    data1TocFileOffset: 0xe83e8,
    descriptorStart: 4,
  },
  "hs": {
    imageSet: { artist: 302, big: 300, genre: 301, small: 299 },
    imageSetSlots: PB_SLOTS,
    data1TocCount: 446,
    data1TocFileOffset: 0x100108,
    descriptorStart: 8,
  },
  "dd": {
    imageSet: { artist: 287, big: 285, genre: 286, small: 284 },
    imageSetSlots: PB_SLOTS,
    data1TocCount: 447,
    data1TocFileOffset: 0x10d7f8,
    descriptorStart: 8,
  },
  "gold": {
    imageSet: { artist: 316, big: 314, genre: 315, small: 313 },
    imageSetSlots: PB_SLOTS,
    data1TocCount: 488,
    data1TocFileOffset: 0x118500,
    descriptorStart: 8,
  },
  "djt": {
    ...PB_LIKE,
    imageSet: { artist: 333, big: 331, genre: 332, small: 330 },
    data1TocCount: 504,
    data1TocFileOffset: 0x131680,
  },
  "emp": {
    ...PB_LIKE,
    imageSet: { artist: 301, big: 299, genre: 300, small: 298 },
    data1TocCount: 463,
    data1TocFileOffset: 0x139d00,
  },
  // 9thとusはジャンルが基準+4で、基準+2は使われていない
  "9th": {
    imageSet: { artist: 173, big: 171, genre: 174, small: 170 },
    imageSetSlots: FIVE_SLOTS,
    data1TocCount: 280,
    data1TocFileOffset: 0xb7c28,
    descriptorStart: 4,
  },
  "us": {
    imageSet: { artist: 47, big: 45, genre: 48, small: 44 },
    imageSetSlots: FIVE_SLOTS,
    data1TocCount: 121,
    data1TocFileOffset: 0xb6ef0,
    descriptorStart: 4,
  },
};

export function displayLayout(generation: string): DisplayLayout {
  const layout = DISPLAY_LAYOUTS[generation];
  if (layout === undefined) {
    throw new Error(`曲名表示資産を移せない世代: ${generation}`);
  }
  return layout;
}

export const hasDisplayAssets = (generation: string): boolean =>
  Object.hasOwn(DISPLAY_LAYOUTS, generation);

/**
 * 素材の`.if`を、周回でファイルに書くときの記述子開始位置。
 * 値があるのは、曲名表示資産のある9th以降の世代だけで、ほかの世代はnullを返す。
 * 記述子が`+4`の世代(9th〜red・US)は、`+8`へ並べ替える。
 * 記述子が`+8`の世代(dd・djt・emp・gold・hs)は、中身を変えずに写す。
 */
export const repackDescriptorStart = (
  generation: string,
): DescriptorStart | null =>
  hasDisplayAssets(generation)
    ? displayLayout(generation).descriptorStart
    : null;

/**
 * djtの5曲。addressはfile offsetである。
 * ELFのvaddrから`0xFFF80`を引いて求めた。
 * この差はPT_LOADのvaddrとfile offsetの差である。
 */
export const PAIRLESS_SONGS: Record<string, PairlessSourceSong[]> = {
  "djt": [
    { songIndex: 9, descriptorOffset: 0x1f7690 },
    { songIndex: 13, descriptorOffset: 0x1f7410 },
    { songIndex: 17, descriptorOffset: 0x1f7550 },
    { songIndex: 25, descriptorOffset: 0x1f7190 },
    { songIndex: 49, descriptorOffset: 0x1f72d0 },
  ],
};

export const pairlessSongsOf = (generation: string): PairlessSourceSong[] =>
  PAIRLESS_SONGS[generation] ?? [];
