import { assertEquals } from "@std/assert";
import type { SongRow } from "../../types.ts";
import { buttonsOf, folderText, keyText } from "./row.ts";

const song = (folderBefore?: string | null) =>
  ({
    folder: "F",
    ...(folderBefore === undefined ? {} : { folderBefore }),
  }) as SongRow;

Deno.test("裏の番号から、選ぶボタンを引く", () => {
  assertEquals(
    [0, 1, 2, 5, 6, 7].map(buttonsOf),
    [
      "SELECT+上",
      "SELECT+下",
      "SELECT+L1+上",
      "SELECT+R1+下",
      "SELECT+L1+R1+上",
      "SELECT+L1+R1+下",
    ],
  );
});

Deno.test("folder列で変えた収録フォルダーは、規則→補正の形にする", () => {
  assertEquals(folderText(song()), "F");
  assertEquals(folderText(song("9th")), "9th→F");
  assertEquals(folderText(song(null)), "?→F");
});

Deno.test("editionで分けた組の曲は、管理名にeditionを添える", () => {
  const front = { edition: "5th", key: "511" } as SongRow;
  assertEquals([keyText(front), keyText({ key: "511" } as SongRow)], [
    "511 (5th)",
    "511",
  ]);
});
