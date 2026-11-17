// 画像セットを分けた後の割り当て。ファイルを読まず、組み立てた参照で確かめる。
// 実行: deno test packages/features/layout/image_set/title/split_parts_test.ts

import type { TitleSpriteRef } from "@csa/core";
import { assignParts } from "./split_parts.ts";

function assertJson(actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`${a} != ${e}`);
  }
}

const SPRITE_MAP = new Map([
  [0, { part: 0, sprite: 0 }],
  [1, { part: 1, sprite: 0 }],
  [2, { part: 2, sprite: 5 }],
]);

const input = {
  kind: "big" as const,
  nextExtraIndex: 2000,
  partCount: 3,
  pbIndex: 1313,
  spriteMap: SPRITE_MAP,
  summaries: ["emp x", "全曲リスト y"],
};

Deno.test("1本目はPBのDATA1 indexを使い、2本目以降は空きの番号を順に使う", () => {
  const plan = assignParts(input, new Map());
  assertJson(plan.files, [
    { data1Index: 1313, summary: "big[1313] emp x / 全曲リスト y" },
    { data1Index: 2000, summary: "big[2000] 1313の分割1" },
    { data1Index: 2001, summary: "big[2001] 1313の分割2" },
  ]);
  assertJson(plan.nextExtraIndex, 2002);
});

Deno.test("分けなければ、空きの番号を使わない", () => {
  const plan = assignParts({ ...input, partCount: 1 }, new Map());
  assertJson(plan.files.length, 1);
  assertJson(plan.nextExtraIndex, 2000);
});

Deno.test("PBの画像セットを指す参照だけを、分けた先へ向け直す", () => {
  const songSprites = new Map<number, TitleSpriteRef[]>([
    [10, [{ fileIndex: 1313, sprite: 2 }, { fileIndex: 1314, sprite: 2 }]],
    [11, [{ fileIndex: 1313, sprite: 1 }, { fileIndex: 1313, sprite: 0 }]],
  ]);
  assignParts(input, songSprites);
  assertJson(songSprites.get(10), [
    { fileIndex: 2001, sprite: 5 },
    { fileIndex: 1314, sprite: 2 },
  ]);
  assertJson(songSprites.get(11), [
    { fileIndex: 2000, sprite: 0 },
    { fileIndex: 1313, sprite: 0 },
  ]);
});

Deno.test("分割後に無いspriteを指す参照があれば例外にする", () => {
  const songSprites = new Map<number, TitleSpriteRef[]>([
    [10, [{ fileIndex: 1313, sprite: 9 }]],
  ]);
  try {
    assignParts(input, songSprites);
  } catch (error) {
    assertJson((error as Error).message, "big sprite 9が分割後に無い");
    return;
  }
  throw new Error("例外が出なかった");
});
