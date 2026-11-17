// legacyの曲名カードを`.if`に収める。
// metadataは、原盤のカードと同じ形をanimationの形式から組む。原盤は読まない。

import { buildIfPackage, padToSector } from "../format/mod.ts";
import { imageSetMetadataOf } from "../image_set/mod.ts";
import { encodeSheet } from "../title_image_set/mod.ts";

const ITEM_BYTES = 0x24;
const NONE = 0xffff;
const SCREEN = { height: 480, width: 640 };
/** animationの先頭は16バイト境界にある。表も16バイト境界に置くため、項目2件の後を0で埋める */
const TABLE_ALIGN = 16;
const ANIMATION_BYTES = Math.ceil(ITEM_BYTES * 2 / TABLE_ALIGN) * TABLE_ALIGN;

/**
 * カードのanimationの部分。種類0xFFFFの終端の項目は、基準位置の2倍を画面の大きさにする。
 * 原盤の`.if`は、最後のanimationの後に、種類0xFFFEで他の欄が-1の項目を必ず持つ。
 * 表の手前の詰め物は、原盤では値が不定なので0にする。
 * ゲームは終端の項目で読むのを止めるので、どちらも読まない(PB実測)。
 */
function cardAnimation(): Uint8Array {
  const out = new Uint8Array(ANIMATION_BYTES);
  const dv = new DataView(out.buffer);
  dv.setUint16(0, 0xffff, true);
  dv.setUint16(2, NONE, true);
  dv.setUint16(6, NONE, true);
  dv.setUint16(8, NONE, true);
  dv.setUint16(0x10, SCREEN.width / 2, true);
  dv.setUint16(0x12, SCREEN.height / 2, true);
  out.fill(0xff, ITEM_BYTES, ITEM_BYTES + 0x14);
  dv.setUint16(ITEM_BYTES, 0xfffe, true);
  return out;
}

export interface CardSheet {
  /** 画素index。sheet幅×sheet高さ */
  indices: Uint8Array;
  /** 色表。i番目の色のindexはi+1で、成分はRGBAの0..255 */
  colors: readonly (readonly number[])[];
  sheet: { h: number; w: number };
}

/** 枠に合わせた絵から`.if`を組む。`.if`の長さは、0で埋めてセクタ倍数にする */
export const packTitleCard = (
  art: { height: number; width: number },
  card: CardSheet,
): Uint8Array => assembleCardPackage(encodeCardSheet(art, card));

/** シートを焼いた結果 */
export interface EncodedCardSheet {
  /** sheetの左上に置くspriteの寸法 */
  art: { height: number; width: number };
  /** 焼いたtexture file */
  bytes: Uint8Array;
  sheet: { h: number; w: number };
}

/** 画素indexと色表を、texture fileに焼く */
export function encodeCardSheet(
  art: { height: number; width: number },
  card: CardSheet,
): EncodedCardSheet {
  const { sheet } = card;
  return {
    art: { height: art.height, width: art.width },
    bytes: encodeSheet(card.indices, card.colors, sheet.w, sheet.h),
    sheet: { h: sheet.h, w: sheet.w },
  };
}

/** 曲名カードのmetadata。spriteは`art`の寸法で、sheetの左上に置く */
export const cardMetadataOf = (
  { art, sheet }: Pick<EncodedCardSheet, "art" | "sheet">,
): Uint8Array =>
  imageSetMetadataOf(
    { animation: cardAnimation(), head: 0 },
    [{ height: sheet.h, width: sheet.w }],
    [{ h: art.height, w: art.width, x: 0, y: 0 }],
  );

const indexName = (index: number) => String(index).padStart(4, "0");

/** legacyの曲名カードの`.if`の置き場。`discsDirectory`は、周回の成果物を世代ごとに置く場所 */
export const titleCardPath = (
  discsDirectory: string,
  generation: string,
  index: number,
) => `${discsDirectory}/${generation}/title_cards/${indexName(index)}.if`;

/** 焼いたシートを`.if`へ組む。出力はDATA1の割当に合わせてセクタ倍数まで0で埋める */
export const assembleCardPackage = (encoded: EncodedCardSheet): Uint8Array =>
  padToSector(buildIfPackage([cardMetadataOf(encoded), encoded.bytes]));
