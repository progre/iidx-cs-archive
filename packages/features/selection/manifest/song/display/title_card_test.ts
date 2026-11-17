// 曲名カードのフィールドをmanifest形式にする判断。
// 実行: deno test packages/features/selection/manifest/song/title_card_test.ts

import { assertEquals } from "@std/assert";
import type { Data1Toc } from "./data1.ts";
import { PB_PAIR_COUNT, titleCardOf } from "./title_card.ts";

const toc: Data1Toc = {
  archive: "data1.dat",
  count: 100,
  rowOf: () => ({ count: 3, sector: 40 }),
};

const pairsOf = (count: number) =>
  Array.from({ length: count }, (_, animation) => ({ animation, file: 12 }));

const animations = (generation: string, songIndex: number, count: number) =>
  titleCardOf(
    { anotherSprite: null, generation, songIndex },
    12,
    pairsOf(count),
    toc,
  ).pairs
    .map(({ animation }) => animation);

Deno.test("mainを示す組だけを移し、別のファイルの組は0にする", () => {
  const card = titleCardOf(
    { anotherSprite: null, generation: "pb", songIndex: 1 },
    12,
    [{ animation: 0, file: 12 }, { animation: 1, file: 13 }],
    toc,
  );
  assertEquals(card.pairs, [
    { animation: 0, titleCard: 12 },
    { animation: 1, titleCard: 0 },
  ]);
  assertEquals(card.sourceOffset, 40 * 2048);
  assertEquals(card.sourceSize, 3 * 2048);
  assertEquals(Object.keys(card)[0], "pairs");
});

Deno.test("PBと同じ選び方の世代は、PBの組の数を超える組を落とす", () => {
  assertEquals(animations("pb", 1, PB_PAIR_COUNT + 1), [0, 1, 2, 3, 4]);
});

Deno.test("6組の世代は、PBに無い組2を落とし、組3以降を1つ前へ詰める", () => {
  assertEquals(animations("gold", 1, 6), [0, 1, 3, 4, 5]);
});

Deno.test("4組の世代は、組0と組3だけをPBの組0と組1へ移す", () => {
  assertEquals(animations("red", 1, 4), [0, 3]);
});

Deno.test("コードでANOTHERのカードを決める曲は、PBの組2で2枚目の絵を出す", () => {
  const card = titleCardOf(
    { anotherSprite: 1, generation: "red", songIndex: 0x50 },
    12,
    pairsOf(1),
    toc,
  );
  assertEquals(card.pairs, [
    { animation: 0, titleCard: 12 },
    { animation: 0, titleCard: 0 },
    { animation: 1, titleCard: 12 },
  ]);
});
