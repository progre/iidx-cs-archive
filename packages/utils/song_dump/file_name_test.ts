// 実行: deno test packages/utils/song_dump/file_name_test.ts

import { embeddedTileDirNameOf, songFileNameOf, sourceNameOf } from "./song.ts";

function assertEquals<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: ${String(actual)} != ${String(expected)}`);
  }
}

Deno.test("曲の名前は世代・3桁の番号・題名をつなぐ", () => {
  assertEquals(songFileNameOf("9th", 7, "A"), "9th_007_A", "3桁に詰める");
  assertEquals(
    songFileNameOf("pb", 12, 'A/B:C?"D". '),
    "pb_012_A_B_C__D_",
    "使えない文字を_にし、末尾の点と空白を外す",
  );
});

Deno.test("埋め込みtileのフォルダーは世代に_tile_elfをつなぐ", () => {
  assertEquals(
    embeddedTileDirNameOf("6th"),
    "6th_tile_elf",
    "曲の名前を含まない",
  );
});

Deno.test("読み出し元はアーカイブ名と番号をつなぐ", () => {
  assertEquals(
    sourceNameOf({ archive: "DATA1.DAT", index: 1312 }),
    "data1_1312",
    "拡張子を外して小文字にする",
  );
  assertEquals(
    sourceNameOf({ archive: "BM2DX7C.BIN", index: 666 }),
    "bm2dx7c_666",
    "主アーカイブも同じ形",
  );
});
