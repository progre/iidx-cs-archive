// 譜面アーカイブの暗号鍵を、実行ファイルの文字列から導く規則。数値だけを持つ。
// 参考: https://github.com/SaxxonPike/iidx-ps2tools の`plugins/`の`generate_encryption_key`

/**
 * 鍵の1文字の取り方。[文字列の番号, 文字列の中の位置]か、実行ファイルの位置。
 * 原盤は固定の文字を命令の即値で書いている。位置は、その命令の先頭である
 */
type Pick = readonly [part: number, at: number] | number;

export interface ChartKeyRule {
  /** 実行ファイルの中の、10個の文字列の先頭の位置 */
  readonly offsets: readonly number[];
  readonly picks: readonly Pick[];
}

const PICKS_14: readonly Pick[] = [
  [1, 8],
  [0, 3],
  [2, 8],
  [3, 4],
  [0, 1],
  [4, 4],
  [5, 0],
  244196,
  [6, 9],
  [7, 2],
  244216,
  [6, 8],
  244228,
  [8, 5],
  [1, 9],
  [9, 3],
];

const PICKS_15: readonly Pick[] = [
  [0, 3],
  244372,
  [2, 7],
  [0, 0],
  [0, 7],
  [3, 5],
  244392,
  [4, 0],
  [5, 7],
  [6, 6],
  [7, 1],
  244392,
  [6, 12],
  [8, 6],
  [8, 9],
  [9, 4],
];

/** PBは16作目と同じ取り方で、文字列と固定の文字の位置だけが違う */
const picks16 = (fixedAt: number): readonly Pick[] => [
  [7, 10],
  [8, 18],
  [5, 10],
  [0, 3],
  [7, 2],
  [8, 7],
  fixedAt,
  [2, 4],
  [5, 4],
  [3, 8],
  [8, 13],
  [6, 3],
  [9, 10],
  [5, 7],
  [1, 3],
  [1, 11],
];

const RULES: Record<string, ChartKeyRule> = {
  djt: {
    offsets: [
      1420520,
      1420536,
      1420544,
      1420560,
      1420584,
      1420600,
      1420616,
      1420632,
      1420640,
      1420664,
    ],
    picks: PICKS_15,
  },
  emp: {
    offsets: [
      1459888,
      1459920,
      1459944,
      1459968,
      1460000,
      1460024,
      1460048,
      1460080,
      1460112,
      1460144,
    ],
    picks: picks16(250104),
  },
  gold: {
    offsets: [
      1318376,
      1318392,
      1318416,
      1318440,
      1318456,
      1318464,
      1318472,
      1318488,
      1318504,
      1318520,
    ],
    picks: PICKS_14,
  },
  pb: {
    offsets: [
      1480880,
      1480912,
      1480936,
      1480960,
      1480992,
      1481016,
      1481040,
      1481072,
      1481104,
      1481136,
    ],
    picks: picks16(250088),
  },
};

/** 譜面を暗号化している世代の規則。暗号が無い世代はnull */
export const chartKeyRuleOf = (generation: string): ChartKeyRule | null =>
  RULES[generation] ?? null;
