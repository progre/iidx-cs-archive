// 全曲リストの文字を描く枠の決定。ファイルを読まず、組み立てた曲と行で確かめる。
// 実行: deno test packages/features/layout/image_set/catalog/catalog_plan_test.ts

import type { ManifestSong } from "@csa/core";
import {
  BLANK,
  drawEntry,
  entriesOfKind,
  planCatalog,
} from "./catalog_plan.ts";
import type { SlotTexts } from "./catalog_text.ts";

function assertJson(actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`${a} != ${e}`);
  }
}

const song = (target: number, generation: string, title: string) =>
  ({
    sourceGeneration: generation,
    targetSongIndex: target,
    title,
  }) as ManifestSong;

const FULL: SlotTexts = {
  artist: "A",
  fullTitle: "T",
  genre: "G",
  subtitle: null,
};
const TITLE_ONLY: SlotTexts = {
  artist: null,
  fullTitle: "T",
  genre: null,
  subtitle: null,
};
const hasAssets = (generation: string) => generation !== "old";

Deno.test("素材の画像セットがある世代は、文字を書いた枠だけを描く", () => {
  const plan = planCatalog(
    [song(10, "pb", "x")],
    () => TITLE_ONLY,
    hasAssets,
  );
  assertJson(plan.entries.map((e) => [e.kind, e.targets]), [
    ["big", [10]],
    ["small", [10]],
  ]);
  assertJson([...plan.drawn.get(10)!], ["big", "small"]);
  assertJson(plan.incomplete, []);
});

Deno.test("素材の画像セットがある世代の曲は、行が無ければ何も描かない", () => {
  const plan = planCatalog([song(10, "pb", "x")], () => undefined, hasAssets);
  assertJson(plan.entries, []);
  assertJson(plan.drawn.size, 0);
});

Deno.test("legacyの曲は、文字の無い枠を共有の透明な絵で埋め、未記載として報告する", () => {
  const plan = planCatalog(
    [song(1, "old", "a"), song(2, "old", "b")],
    (target) => target.targetSongIndex === 1 ? TITLE_ONLY : FULL,
    hasAssets,
  );
  assertJson(plan.incomplete, ["old/a"]);
  assertJson(
    plan.entries.map((e) => [e.kind, e.segments === null, e.targets]),
    [
      ["big", false, [1]],
      ["small", false, [1]],
      ["artist", false, [2]],
      ["big", false, [2]],
      ["genre", false, [2]],
      ["small", false, [2]],
      ["artist", true, [1]],
      ["genre", true, [1]],
    ],
  );
  assertJson([...plan.drawn.get(1)!].sort(), [
    "artist",
    "big",
    "genre",
    "small",
  ]);
});

Deno.test("legacyの曲は、行が無ければ4枠とも共有の透明な絵を指す", () => {
  const plan = planCatalog([song(1, "old", "a")], () => undefined, hasAssets);
  assertJson(plan.entries.map((e) => [e.kind, e.segments]), [
    ["artist", null],
    ["big", null],
    ["genre", null],
    ["small", null],
  ]);
  assertJson(plan.incomplete, ["old/a"]);
});

Deno.test("文字の無い枠は描画を呼ばず、共有の透明な絵になる", async () => {
  const render = () => Promise.reject(new Error("呼ばれてはならない"));
  const image = await drawEntry(
    { kind: "big", segments: null, targets: [1] },
    render,
  );
  assertJson(image === BLANK, true);
});

Deno.test("文字のある枠は、文字と枠の種類を渡して描く", async () => {
  const drawn = { height: 2, rgba: new Uint8Array(8), width: 1 };
  const calls: unknown[] = [];
  const image = await drawEntry(
    { kind: "genre", segments: [{ text: "x" }], targets: [1] },
    (segments, kind) => {
      calls.push([segments, kind]);
      return Promise.resolve(drawn);
    },
  );
  assertJson(image === drawn, true);
  assertJson(calls, [[[{ text: "x" }], "genre"]]);
});

Deno.test("枠に描く絵は、計画の並びを保って取り出す", () => {
  const entries = [
    { kind: "big" as const, segments: null, targets: [1] },
    { kind: "small" as const, segments: null, targets: [2] },
    { kind: "big" as const, segments: null, targets: [3] },
  ];
  assertJson(entriesOfKind(entries, "big")?.map((e) => e.targets), [[1], [3]]);
});

Deno.test("描く絵が無い枠は、undefinedを返す", () => {
  const entries = [{ kind: "big" as const, segments: null, targets: [1] }];
  assertJson(entriesOfKind(entries, "genre"), undefined);
});
