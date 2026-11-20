// 全曲リストの行から裏エントリーの組を集める。ファイルを読まず、組み立てた行で確かめる。

import { assertEquals, assertThrows } from "@std/assert";
import { catalogVariantsOf } from "./catalog_variants.ts";
import type { GenerationCatalog } from "./catalog_groups.ts";
import type { CatalogFront, CatalogRow } from "../csv.ts";

const row = (name: string, line: number, front?: CatalogFront) =>
  ({ line, name, songId: null, ...(front ? { front } : {}) }) as CatalogRow;

/** テストでは、曲の索引のキーの代わりに、管理名を大文字にした値を使う */
const keyOf = (_: string, { name }: CatalogRow) => name.toUpperCase();

/** テストでは、曲番号を97以上にした行を原作の5鍵盤版とする */
const isTwin = (_: string, { songId }: CatalogRow) => (songId ?? 0) >= 97;

const variantsOf = (catalogs: GenerationCatalog[]) =>
  catalogVariantsOf(catalogs, keyOf, isTwin).map((v) =>
    `${v.generation}/${v.title}->${v.frontGeneration}/${v.frontTitle}` +
    (v.position === undefined ? "" : `#${v.position}`)
  );

Deno.test("キーが同じ行を組にし、最も後の作品の行を表にする", () => {
  assertEquals(
    variantsOf([
      { generation: "3rd", rows: [row("a", 2), row("b", 3)] },
      { generation: "pb", rows: [row("A", 2)] },
    ]),
    ["3rd/a->pb/A#0"],
  );
});

Deno.test("editionを書いた行は、同じキーのほかの行と別の組にする", () => {
  assertEquals(
    variantsOf([
      { generation: "3rd", rows: [{ ...row("a", 2), edition: "3rd" }] },
      { generation: "5th", rows: [{ ...row("A", 2), edition: "3rd" }] },
      { generation: "pb", rows: [row("A", 2)] },
    ]),
    ["3rd/a->5th/A#0"],
  );
});

Deno.test("同じ曲を2行に書いてどちらも表になれば、裏は表の行番号で表を指す", () => {
  const pairs = catalogVariantsOf(
    [
      {
        generation: "7th",
        rows: [
          row("A", 2, { slotOwner: true }),
          { ...row("A", 3, { slotOwner: true }), edition: "7th" },
        ],
      },
      {
        generation: "8th",
        rows: [row("a", 4), { ...row("a", 5), edition: "7th" }],
      },
    ],
    keyOf,
    isTwin,
  ).map(({ frontLine, line }) => [line, frontLine]);
  assertEquals(pairs, [[4, 2], [5, 3]]);
});

Deno.test("us の行は、ほかの作品の行より後に表の候補にする", () => {
  assertEquals(
    variantsOf([
      { generation: "3rd", rows: [row("A", 2)] },
      { generation: "us", rows: [row("a", 2)] },
    ]),
    ["us/a->3rd/A#0"],
  );
});

Deno.test("save_slot_ownerを書いた行を枠の持ち主にし、既定では表にする", () => {
  assertEquals(
    variantsOf([
      { generation: "3rd", rows: [row("A", 2, { slotOwner: true })] },
      { generation: "4th", rows: [row("a", 2)] },
    ]),
    ["4th/a->3rd/A#0"],
  );
});

Deno.test("組に PB の行があれば PB の行が枠の持ち主で、save_slot_ownerは書けない", () => {
  assertThrows(
    () =>
      variantsOf([
        { generation: "3rd", rows: [row("A", 2, { slotOwner: true })] },
        { generation: "pb", rows: [row("a", 2)] },
      ]),
    Error,
    "3rdの全曲リスト line 2: 組に PB の行があるので、枠の持ち主を書けない",
  );
});

Deno.test("表を選ぶ関数で持ち主と別の行を表にすると、持ち主の裏に印を付ける", () => {
  const variants = catalogVariantsOf(
    [
      { generation: "3rd", rows: [row("A", 2)] },
      { generation: "4th", rows: [row("a", 2)] },
    ],
    keyOf,
    isTwin,
    (candidates) => candidates[0],
  );
  assertEquals(
    variants.map((v) => [v.generation, v.frontGeneration, v.slotOwner]),
    [["4th", "3rd", true]],
  );
});

Deno.test("枠の持ち主の候補が同じ作品に2行あるとエラーになる", () => {
  assertThrows(
    () => variantsOf([{ generation: "pb", rows: [row("A", 2), row("a", 3)] }]),
    Error,
    "pbの全曲リスト line 2, 3: 組の枠の持ち主の候補が同じ作品に2行ある",
  );
});

Deno.test("裏は古い作品から順に番号を振り、us は最後にする", () => {
  assertEquals(
    variantsOf([
      { generation: "3rd", rows: [row("A", 2)] },
      { generation: "4th", rows: [row("A", 2)] },
      { generation: "us", rows: [row("A", 2)] },
      { generation: "pb", rows: [row("A", 2)] },
    ]),
    ["3rd/A->pb/A#0", "4th/A->pb/A#1", "us/A->pb/A#2"],
  );
});

Deno.test("front_ruleを書いた行は、表にせず、条件を持つ裏にする", () => {
  const variants = catalogVariantsOf(
    [
      { generation: "3rd", rows: [row("A", 2)] },
      { generation: "pb", rows: [row("A", 2, { rule: { kind: "always" } })] },
    ],
    keyOf,
    isTwin,
  );
  assertEquals(
    variants.map((v) => [v.generation, v.frontGeneration, v.position, v.rule]),
    [["pb", "3rd", undefined, { kind: "always" }]],
  );
});

Deno.test("excludeを書いた行は、組に入れない", () => {
  assertEquals(
    variantsOf([
      { generation: "3rd", rows: [{ ...row("A", 2), exclude: true }] },
      { generation: "pb", rows: [row("A", 2)] },
    ]),
    [],
  );
});

Deno.test("chart_movesは、難易度名の表になる", () => {
  const [variant] = catalogVariantsOf(
    [
      { generation: "3rd", rows: [row("A", 2, { chartMoves: { sl: "sa" } })] },
      { generation: "pb", rows: [row("A", 2)] },
    ],
    keyOf,
    isTwin,
  );
  assertEquals(variant.chartMoves, { sp_black: "sp_another" });
});

Deno.test("同じ表の曲に9曲目の裏があるとエラーになる", () => {
  const backs = Array.from({ length: 9 }, (_, i) => ({
    generation: `g${i}`,
    rows: [row("A", 2)],
  }));
  assertThrows(
    () => variantsOf([...backs, { generation: "pb", rows: [row("A", 2)] }]),
    Error,
    "pb/Aの裏は8曲までにする",
  );
});

Deno.test("キーが空の行は、組にしない", () => {
  assertEquals(
    variantsOf([
      { generation: "3rd", rows: [row(" ", 2)] },
      { generation: "pb", rows: [row(" ", 2)] },
    ].map((c) => ({ ...c, rows: c.rows.map((r) => ({ ...r, name: "" })) }))),
    [],
  );
});
