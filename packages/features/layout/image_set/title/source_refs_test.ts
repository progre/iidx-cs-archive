// 追加曲の分類と、画像セット欄の初期値。ファイルを読まず、組み立てた曲で確かめる。
// 実行: deno test packages/features/layout/image_set/title/source_refs_test.ts

import type { ManifestSong, TitleSpriteRef } from "@csa/core";
import {
  collectSourceRefs,
  generationsOf,
  groupSongs,
  initialSongSprites,
} from "./source_refs.ts";

function assertJson(actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`${a} != ${e}`);
  }
}

const song = (
  target: number,
  generation: string,
  titleCard: boolean,
): ManifestSong =>
  ({
    sourceGeneration: generation,
    targetSongIndex: target,
    ...(titleCard ? { titleCard: {} } : {}),
  }) as ManifestSong;

const hasAssets = (generation: string) => generation !== "old";

Deno.test("曲は、曲名カードがある曲とlegacyの曲に分け、それ以外は使わない", () => {
  const groups = groupSongs(
    [song(1, "pb", true), song(2, "pb", false), song(3, "old", false)],
    hasAssets,
  );
  assertJson(groups.cardSongs.map((s) => s.targetSongIndex), [1]);
  assertJson(groups.legacySongs.map((s) => s.targetSongIndex), [3]);
});

Deno.test("世代は、初めに現れた順に重複なく並べる", () => {
  assertJson(
    generationsOf([
      song(1, "emp", true),
      song(2, "djt", true),
      song(3, "emp", true),
    ]),
    ["emp", "djt"],
  );
});

Deno.test("曲ごとの素材側の参照は、追加先の曲番号で束ねる", () => {
  const songs = [song(10, "emp", true), song(12, "djt", true)];
  const collected = collectSourceRefs(songs, (s) => [
    { fileIndex: s.targetSongIndex, sprite: 0 },
  ]);
  assertJson([...collected.sourceRefs.keys()], [10, 12]);
  assertJson([...collected.generationOf], [[10, "emp"], [12, "djt"]]);
});

Deno.test("初期値は、素材側の欄の並びを保ち、legacyの曲には4欄を置く", () => {
  const refs = new Map<number, TitleSpriteRef[]>([
    [10, [{ fileIndex: 7, sprite: 1 }, { fileIndex: 8, sprite: 2 }]],
    [11, [{ fileIndex: 7, sprite: 3 }]],
  ]);
  const initial = initialSongSprites(refs, [song(20, "old", false)]);
  assertJson(initial.get(10), [
    { fileIndex: 7, sprite: -1 },
    { fileIndex: 8, sprite: -1 },
  ]);
  assertJson(initial.get(20), Array(4).fill({ fileIndex: -1, sprite: -1 }));
  assertJson([...initial.keys()], [10, 11, 20]);
});
