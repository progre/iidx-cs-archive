// 曲名spriteの足し先と、sprite参照の向け直し。ファイルを読まず、組み立てた参照で確かめる。
// 実行: deno test packages/features/layout/image_set/title/title_sets_test.ts

import type { TitleSpriteRef } from "@csa/core";
import { initialSongSprites } from "./source_refs.ts";
import {
  assertAllReplaced,
  type CopyScope,
  neededSprites,
  pointToCopied,
  pointToDrawn,
  silverFor,
} from "./title_sets.ts";

function assertJson(actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`${a} != ${e}`);
  }
}

function assertThrows(run: () => void, message: string): void {
  try {
    run();
  } catch (error) {
    assertJson((error as Error).message, message);
    return;
  }
  throw new Error("例外が出なかった");
}

const REFS = new Map<number, TitleSpriteRef[]>([
  [10, [{ fileIndex: 7, sprite: 1 }, { fileIndex: 8, sprite: 2 }]],
  [11, [{ fileIndex: 7, sprite: 3 }, { fileIndex: 8, sprite: 4 }]],
  [12, [{ fileIndex: 7, sprite: 5 }, { fileIndex: 8, sprite: 6 }]],
]);
const GENERATION_OF = new Map([[10, "emp"], [11, "emp"], [12, "djt"]]);

function scope(overrides: Partial<CopyScope> = {}): CopyScope {
  return {
    drawn: new Map(),
    generation: "emp",
    generationOf: GENERATION_OF,
    kind: "big",
    sourceIndex: 7,
    sourceRefs: REFS,
    ...overrides,
  };
}

Deno.test("シルバーの手本を使う世代は、emp以外である", () => {
  assertJson(silverFor("emp", [0.5]), null);
  assertJson(silverFor("djt", [0.5]), [0.5]);
});

Deno.test("写すspriteは、その世代の曲が、その画像セットを指す欄から選ぶ", () => {
  assertJson(neededSprites(scope()), [1, 3]);
});

Deno.test("文字を描く枠の曲は、素材からspriteを写さない", () => {
  const drawn = new Map([[10, new Set(["big" as const])]]);
  assertJson(neededSprites(scope({ drawn })), [3]);
  assertJson(neededSprites(scope({ drawn, kind: "small" })), [1, 3]);
});

Deno.test("写すspriteが無ければ、undefinedを返す", () => {
  assertJson(neededSprites(scope({ sourceIndex: 99 })), undefined);
  assertJson(neededSprites(scope({ generation: "pb" })), undefined);
});

Deno.test("写した曲の参照は、PBの画像セットの新しいspriteへ向ける", () => {
  const songSprites = initialSongSprites(REFS, []);
  pointToCopied(
    songSprites,
    scope(),
    1313,
    new Map([[1, 100], [3, 101]]),
  );
  assertJson(songSprites.get(10), [
    { fileIndex: 1313, sprite: 100 },
    { fileIndex: 8, sprite: -1 },
  ]);
  assertJson(songSprites.get(11)![0], { fileIndex: 1313, sprite: 101 });
  assertJson(songSprites.get(12), [
    { fileIndex: 7, sprite: -1 },
    { fileIndex: 8, sprite: -1 },
  ]);
});

Deno.test("新しいspriteが割り当てられていない参照があれば例外にする", () => {
  assertThrows(
    () => pointToCopied(initialSongSprites(REFS, []), scope(), 1313, new Map()),
    "song10 のbig spriteが割り当てられていない",
  );
});

Deno.test("描いた絵を指す曲は、枠の位置の参照を新しいspriteへ向ける", () => {
  const four = Array.from({ length: 4 }, () => ({ fileIndex: 0, sprite: 0 }));
  const songSprites = initialSongSprites(
    new Map([[10, four], [11, four], [12, four]]),
    [],
  );
  pointToDrawn(
    songSprites,
    "small",
    1312,
    [{ targets: [10, 11] }, { targets: [12] }],
    [50, 51],
  );
  assertJson(songSprites.get(10)![3], { fileIndex: 1312, sprite: 50 });
  assertJson(songSprites.get(11)![3], { fileIndex: 1312, sprite: 50 });
  assertJson(songSprites.get(12)![3], { fileIndex: 1312, sprite: 51 });
  assertJson(songSprites.get(12)![0], { fileIndex: 0, sprite: -1 });
});

Deno.test("置き換えられていない参照が残っていれば例外にする", () => {
  const songSprites = initialSongSprites(REFS, []);
  assertThrows(
    () => assertAllReplaced(songSprites),
    "song10 に置き換えられていない画像セット欄がある",
  );
  songSprites.forEach((refs, key) =>
    songSprites.set(key, refs.map((ref) => ({ ...ref, sprite: 0 })))
  );
  assertAllReplaced(songSprites);
});
