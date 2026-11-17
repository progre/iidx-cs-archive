// 組の副題を表の行へ寄せ、2行目を表にした行を確かめる。ファイルを読まず、組み立てた行で確かめる。

import { assertEquals, assertThrows } from "@std/assert";
import { withGroupSubtitles } from "./catalog_groups.ts";
import type { CatalogFront, CatalogRow } from "../tsv.ts";

const row = (name: string, line: number, front?: CatalogFront) =>
  ({ line, name, songId: null, ...(front ? { front } : {}) }) as CatalogRow;

/** テストでは、曲の索引のキーの代わりに、管理名を大文字にした値を使う */
const keyOf = (_: string, { name }: CatalogRow) => name.toUpperCase();

const isTwin = () => false;

Deno.test("組のどれかの行に書いた副題は、表の行に付け、ほかの行からは消す", () => {
  const [third, pb] = withGroupSubtitles(
    [
      { generation: "3rd", rows: [{ ...row("A", 2), subtitle: "(S)" }] },
      { generation: "pb", rows: [{ ...row("A", 2), subtitle: null }] },
    ],
    keyOf,
    isTwin,
  );
  assertEquals(
    [third.rows[0].subtitle, pb.rows[0].subtitle],
    [null, "(S)"],
  );
});

Deno.test("組の中に違う副題が2つあるとエラーになる", () => {
  assertThrows(
    () =>
      withGroupSubtitles(
        [
          { generation: "3rd", rows: [{ ...row("A", 2), subtitle: "(S)" }] },
          { generation: "pb", rows: [{ ...row("A", 2), subtitle: "(T)" }] },
        ],
        keyOf,
        isTwin,
      ),
    Error,
    "組に違う副題が2つある",
  );
});
