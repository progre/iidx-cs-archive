// 周回で書いたbundleと最終の選曲の突き合わせ。
// 実行: deno test packages/features/layout/sound_bundle/lap_test.ts

import { assertEquals, assertThrows } from "@std/assert";
import {
  keptRanges,
  retainedIndices,
  type SoundOccurrence,
  soundTargetKey,
} from "./lap.ts";
import type { SoundTarget } from "./rows.ts";

const occurrence = (
  size: number,
  unchanged = false,
  sameAs?: number,
): SoundOccurrence => ({ converted: { size }, key: "k", sameAs, unchanged });

Deno.test("音の位置は、種別・書庫・位置・大きさで決まる", () => {
  const target = {
    archiveName: "A.DAT",
    asset: { sourceOffset: 4, sourceSize: 8 },
    kind: "bgm",
  } as unknown as SoundTarget;
  assertEquals(soundTargetKey(target), "bgm\tA.DAT\t4\t8");
});

Deno.test("最終の並びが周回の並びの部分列なら、残す位置を返す", () => {
  assertEquals(retainedIndices(["a", "b", "c", "b"], ["a", "c", "b"]), [
    0,
    2,
    3,
  ]);
  assertEquals(retainedIndices(["a", "b"], []), []);
});

Deno.test("部分列でなければ例外にする", () => {
  assertThrows(
    () => retainedIndices(["a", "b"], ["b", "a"]),
    Error,
    "順が違う",
  );
  assertThrows(() => retainedIndices(["a"], ["x"]), Error, "x");
});

Deno.test("残す音の範囲は、書いた順に並ぶ", () => {
  const occurrences = [
    occurrence(10),
    occurrence(5, true),
    occurrence(7),
    occurrence(3),
  ];
  const all = keptRanges(occurrences, [0, 1, 2, 3]);
  assertEquals(all.bundle, {
    dropped: false,
    kept: [
      { offset: 0, size: 10 },
      { offset: 10, size: 5 },
      { offset: 15, size: 7 },
      { offset: 22, size: 3 },
    ],
  });
  const some = keptRanges(occurrences, [0, 3]);
  assertEquals(some.bundle, {
    dropped: true,
    kept: [{ offset: 0, size: 10 }, { offset: 22, size: 3 }],
  });
  assertEquals([...some.offsetOf], [[0, 0], [3, 10]]);
});

Deno.test("同じ範囲を先に書いた音が外れても、後の音が残るなら先を残す", () => {
  const occurrences = [
    occurrence(4, true),
    occurrence(6, true),
    occurrence(4, true, 0),
  ];
  const kept = keptRanges(occurrences, [1, 2]);
  assertEquals(kept.bundle, {
    dropped: false,
    kept: [{ offset: 0, size: 4 }, { offset: 4, size: 6 }],
  });
  assertEquals([...kept.offsetOf], [[0, 0], [1, 4]]);
});
