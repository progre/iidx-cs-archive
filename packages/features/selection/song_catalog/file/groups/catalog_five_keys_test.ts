// 全曲リストの five_keys の行から5鍵盤版の組を集める。ファイルを読まず、組み立てた行で確かめる。

import { assertEquals } from "@std/assert";
import { catalogFiveKeysOf, catalogVariantsOf } from "./catalog_variants.ts";
import type { CatalogFront, CatalogRow } from "../csv.ts";

const row = (name: string, line: number, front?: CatalogFront) =>
  ({ line, name, songId: null, ...(front ? { front } : {}) }) as CatalogRow;

/** テストでは、曲の索引のキーの代わりに、管理名を大文字にした値を使う */
const keyOf = (_: string, { name }: CatalogRow) => name.toUpperCase();

/** テストでは、曲番号を97以上にした行を原作の5鍵盤版とする */
const isTwin = (_: string, { songId }: CatalogRow) => (songId ?? 0) >= 97;

Deno.test("five_keysの行は、裏にせず、組の表の5鍵盤版にする", () => {
  const catalogs = [
    { generation: "red", rows: [row("A", 2)] },
    { generation: "us", rows: [row("a", 2, { fiveKeys: true })] },
  ];
  assertEquals(catalogVariantsOf(catalogs, keyOf, isTwin), []);
  assertEquals(
    catalogFiveKeysOf(catalogs, keyOf, isTwin).map((p) =>
      `${p.generation}/${p.title}->${p.frontGeneration}/${p.frontTitle}`
    ),
    ["us/a->red/A"],
  );
});

Deno.test("組が原作の5鍵盤版を持てば、five_keysの行はその5鍵盤版の裏にする", () => {
  const catalogs = [
    { generation: "gold", rows: [row("A", 2), { ...row("A", 3), songId: 97 }] },
    { generation: "us", rows: [row("a", 2, { fiveKeys: true })] },
  ];
  assertEquals(
    catalogVariantsOf(catalogs, keyOf, isTwin).map((v) =>
      `${v.generation}/${v.title}->${v.frontGeneration}/${v.frontTitle}#${v.position}`
    ),
    ["us/a->gold/A:97#0"],
  );
  assertEquals(catalogFiveKeysOf(catalogs, keyOf, isTwin), []);
});
