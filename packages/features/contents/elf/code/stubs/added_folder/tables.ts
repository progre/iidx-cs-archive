// 分類で引く4つの表(札・名前・大きな名前・音)を、追加の分類まで延ばして追加コード領域へ写す。
// 原盤の表は追加の分類に届かないので、表の番地を作る`lui`/`addiu`の組を新しい表へ向ける。

import type { FolderNameImages } from "../../../model/mod.ts";
import { ADDED_CATEGORY, TABLE_ENTRIES } from "./sites.ts";

/** 札の画像。バージョン別フォルダーと同じ札を使う */
const VERSION_PLATE = 28;
/**
 * 名前の画像が無いときの値。一覧の名前は描かない(-1)。
 * 大きな名前は-1を描けるか確かめていないので、分類0の画像(`0x262ee0`の0行目)で代える
 */
const NO_NAMES: FolderNameImages = { big: (1317 << 16) | 111, label: -1 };

export interface CategoryTable {
  /** 追加の分類の行に書く値 */
  added: number;
  name: string;
  /** 表の番地を作る組。`lui`と`addiu`の番地 */
  pairs: readonly (readonly [number, number])[];
  source: number;
}

/** 名前の画像は配置で決まるので引数で受け取る */
export const categoryTables = (
  names = NO_NAMES,
): readonly CategoryTable[] => [
  {
    added: VERSION_PLATE,
    name: "札",
    pairs: [
      [0x1d902c, 0x1d9030],
      [0x1d9430, 0x1d9438],
      [0x1db144, 0x1db14c],
      [0x1db31c, 0x1db324],
    ],
    source: 0x264800,
  },
  {
    added: names.label,
    name: "名前",
    pairs: [
      [0x1d8fc0, 0x1d8fd0],
      [0x1d93d0, 0x1d93e0],
      [0x1db0e4, 0x1db0ec],
      [0x1db2c4, 0x1db2cc],
    ],
    source: 0x264920,
  },
  {
    // カーソルを合わせたフォルダーの名前。`0x18d60c`で読む
    added: names.big,
    name: "大きな名前",
    pairs: [[0x18d5f4, 0x18d5f8]],
    source: 0x262ee0,
  },
  {
    // 声のバンクでこのフォルダー名を読み上げる行。PBの表は使っていない
    added: 0x11,
    name: "音",
    pairs: [[0x189940, 0x189944]],
    source: 0x262d40,
  },
];

export const TABLE_BYTES = TABLE_ENTRIES * 4;

/**
 * 延ばした表の各行の値。追加の分類の行だけを替え、他の行は原盤の同じ位置の値を写す。
 * 原盤の表の終わりより先の行も写すので、原盤がそこで参照していた値は変わらない
 */
export function tableWords(
  table: CategoryTable,
  wordAt: (address: number) => number,
): number[] {
  return Array.from(
    { length: TABLE_ENTRIES },
    (_, category) =>
      category === ADDED_CATEGORY
        ? table.added >>> 0
        : wordAt(table.source + category * 4),
  );
}
