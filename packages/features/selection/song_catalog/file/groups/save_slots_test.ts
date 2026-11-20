// 組のセーブの曲indexの決め方。ファイルを読まず、組み立てた行で確かめる。

import { assertEquals } from "@std/assert";
import { saveSlotsOf } from "./save_slots.ts";
import type { CatalogRow } from "../csv.ts";

const row = (name: string, line: number) =>
  ({ line, name, songId: null }) as CatalogRow;

/** テストでは、曲の索引のキーの代わりに、管理名を大文字にした値を使う */
const keyOf = (_: string, { name }: CatalogRow) => name.toUpperCase();
const isTwin = () => false;

Deno.test("オーナーの全曲リストの順で99から振り、組の行はすべて組の曲indexを引く", () => {
  const slots = saveSlotsOf(
    [
      { generation: "3rd", rows: [row("B", 2), row("a", 3)] },
      { generation: "5th", rows: [row("A", 2), row("C", 3)] },
    ],
    keyOf,
    isTwin,
  );
  assertEquals(slots.count, 3);
  assertEquals(
    [...slots.indexOf].toSorted(([a], [b]) => a.localeCompare(b)),
    [["3rd@2", 99], ["3rd@3", 100], ["5th@2", 100], ["5th@3", 101]],
  );
});

Deno.test("オーナーが PB の組は、PB の枠を使うので曲indexを振らない", () => {
  const slots = saveSlotsOf(
    [
      { generation: "3rd", rows: [row("A", 2), row("B", 3)] },
      { generation: "pb", rows: [row("a", 2)] },
    ],
    keyOf,
    isTwin,
  );
  assertEquals(slots.count, 1);
  assertEquals([...slots.indexOf], [["3rd@3", 99]]);
});

Deno.test("原作の5鍵盤版は自分の曲indexを持ち、five_keys の行はその曲indexを引く", () => {
  const twin = { ...row("A", 3), songId: 97 };
  const fiveKeys = { ...row("a", 2), front: { fiveKeys: true as const } };
  const slots = saveSlotsOf(
    [
      { generation: "gold", rows: [row("A", 2), twin] },
      { generation: "us", rows: [fiveKeys] },
    ],
    keyOf,
    (_, { songId }) => (songId ?? 0) >= 97,
  );
  assertEquals(slots.count, 2);
  assertEquals(
    [...slots.indexOf].toSorted(([a], [b]) => a.localeCompare(b)),
    [["gold@2", 99], ["gold@3", 100], ["us@2", 100]],
  );
});
