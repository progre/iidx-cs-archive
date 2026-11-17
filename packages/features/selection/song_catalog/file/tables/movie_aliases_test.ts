// ムービーの別名の表の読み込み。ファイルを読まず、組み立てた文字列で確かめる。

import { assertEquals, assertThrows } from "@std/assert";
import { parseMovieAliases, parseMoviePicks } from "./movie_aliases.ts";

const HEADER = "generation,id,alias,pick\n";

Deno.test("世代と番号から、別名を引く表にする", () => {
  assertEquals(
    parseMovieAliases(HEADER + "3rd,315,2nd_house,\npb,1024,2nd_house,*\n"),
    new Map([["3rd:315", "2nd_house"], ["pb:1024", "2nd_house"]]),
  );
});

Deno.test("別名から、pick に*を書いた1本を引く表にする", () => {
  assertEquals(
    parseMoviePicks(HEADER + "3rd,315,2nd_house,\npb,1024,2nd_house,*\n"),
    new Map([["2nd_house", { generation: "pb", id: 1024 }]]),
  );
});

Deno.test("列名の行が違うとエラーになる", () => {
  assertThrows(
    () => parseMovieAliases("generation,id,alias\n"),
    Error,
    "line 1: unexpected header",
  );
});

Deno.test("世代・番号・別名のどれかが空の行はエラーになる", () => {
  assertThrows(
    () => parseMovieAliases(HEADER + "3rd,315,,\n"),
    Error,
    "line 2: 世代・番号・別名を書く",
  );
});

Deno.test("pick に*以外を書くとエラーになる", () => {
  assertThrows(
    () => parseMovieAliases(HEADER + "3rd,315,a,x\n"),
    Error,
    "line 2: pickには*を書く",
  );
});

Deno.test("同じ世代と番号が2行あるとエラーになる", () => {
  assertThrows(
    () => parseMovieAliases(HEADER + "3rd,315,a,\n3rd,315,b,\n"),
    Error,
    "line 3: 3rd:315の別名を2回書いている",
  );
});

Deno.test("同じ別名の2行に*を書くとエラーになる", () => {
  assertThrows(
    () => parseMoviePicks(HEADER + "3rd,315,a,*\npb,1024,a,*\n"),
    Error,
    "line 3: 別名aのpickを2行に書いている",
  );
});
