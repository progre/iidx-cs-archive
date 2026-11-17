// 曲名カード(`.if`)のフィールドを、manifest形式にする。

import type { ManifestTitleCard, TitleCardPair } from "@csa/core";
import { data1Slice, type Data1Toc } from "./data1.ts";

/**
 * PBの曲DBに載る(絵の番号, 曲名カード)の組の数。
 * 絵の番号は、カードの`.if`の何枚目のspriteを出すかである。欄の名前は`animation`である
 */
export const PB_PAIR_COUNT = 5;

/** PBがANOTHERで選ぶ組 */
const PB_ANOTHER_PAIR = 2;

/**
 * 素材の組を、同じ条件で選ばれるPBの組の位置へ移す表。添字は素材の組の位置である。
 * `null`の組は、PBに同じ条件で選ばれる組が無いので移さない。
 * 表に無い世代は、PBと同じ位置の組を同じ条件で選ぶ。
 */
const PB_PAIR_OF: Readonly<Record<string, readonly (number | null)[]>> = {
  dd: [0, 1, null, 2, 3, 4],
  gold: [0, 1, null, 2, 3, 4],
  red: [0, null, null, 1],
};

const EMPTY_PAIR: TitleCardPair = { animation: 0, titleCard: 0 };

/**
 * 素材の世代と、その世代の曲DBのindex。
 * `anotherSprite`は、原作が組ではなくコードの分岐でANOTHERに出す絵の番号である。無ければ`null`
 */
export interface TitleCardOrigin {
  anotherSprite: number | null;
  generation: string;
  songIndex: number;
}

function pbPairsOf(
  origin: TitleCardOrigin,
  main: number,
  pairs: readonly { animation: number; file: number }[],
): TitleCardPair[] {
  const slots = PB_PAIR_OF[origin.generation] ??
    Array.from({ length: PB_PAIR_COUNT }, (_, slot) => slot);
  const placed = new Map<number, TitleCardPair>(
    pairs.flatMap(({ animation, file }, index) => {
      const slot = slots[index];
      return slot == null ? [] : [[slot, {
        animation,
        titleCard: file === main ? file : 0,
      }]];
    }),
  );
  if (origin.anotherSprite !== null) {
    placed.set(PB_ANOTHER_PAIR, {
      animation: origin.anotherSprite,
      titleCard: main,
    });
  }
  const length = Math.max(0, ...[...placed.keys()].map((slot) => slot + 1));
  return Array.from({ length }, (_, slot) => placed.get(slot) ?? EMPTY_PAIR);
}

/**
 * 曲名カードの組と、DATA1 TOCの行から、曲名カードの参照を組み立てる。
 * 曲名カードは`main`のDATA1 indexが示す1本である。
 * PBが使うのは`main`を示す組なので、別ファイルを示す組はファイルを0にする。
 */
export function titleCardOf(
  origin: TitleCardOrigin,
  main: number,
  pairs: readonly { animation: number; file: number }[],
  toc: Data1Toc,
): ManifestTitleCard {
  return {
    pairs: pbPairsOf(origin, main, pairs),
    ...data1Slice(`song${origin.songIndex}`, main, toc),
  };
}
