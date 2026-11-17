// 共有画像セット(DATA1 1312〜1315)の種類ごとに、文字を描くときの設定を持つ。
// 見た目の値はdata/text_styles.tomlにあり、spriteの上限だけをここに持つ。

import type { TextKind } from "@csa/core";

export type { TextKind };

/** 縦の濃淡の色。atは文字の上端を0、下端を1とした位置 */
export interface GradientStop {
  at: number;
  color: string;
}

/** 定義ファイルが持つ見た目の設定 */
export interface TextLook {
  /** フォントのフォルダーの中のファイル名 */
  font: string;
  /**
   * 大文字Hの高さ(px)。文字の大きさをこれで揃え、画像の高さは文字に応じて変わる。
   * 文字の上端から下端で合わせると、Qやyのある文字だけ小さくなる。
   */
  capHeight: number;
  /** 黒い縁の幅(px)。小数も取る */
  outline: number;
  /** 縁の外側に足す、アンチエイリアスでぼかす幅(px) */
  outlineSoftness: number;
  /** 副題を本題の何倍の大きさで描くか */
  subtitleScale: number;
  /** 大きさを決めた後に、横を何倍に縮めるか */
  widthScale: number;
  /** 字の間に足す幅。字の大きさに対する割合で、負なら詰める */
  letterSpacing: number;
  /** 文字を下へずらす量(px)。画像の上に、この高さの透明な行を足す */
  offsetY: number;
  /**
   * 画像の上端から基準線までの高さ(px)。書くと、どの文字でも基準線と大きさが揃う。
   * 画像の高さは上限に固定し、大きさは`capHeight`だけで決め、枠を出た部分は切る
   */
  baseline?: number;
  gradient: GradientStop[];
}

/** PBのspriteの上限(px、縁を含む)。幅を超えたら横だけ縮め、高さを超えたら全体を縮める */
export interface SpriteLimit {
  maxWidth: number;
  maxHeight: number;
}

export type TextStyle = TextLook & SpriteLimit;

/** PB実測のspriteの最大寸法 */
export const SPRITE_LIMITS: Record<TextKind, SpriteLimit> = {
  listTitle: { maxWidth: 266, maxHeight: 20 },
  bigTitle: { maxWidth: 262, maxHeight: 43 },
  genre: { maxWidth: 219, maxHeight: 15 },
  artist: { maxWidth: 208, maxHeight: 18 },
};
