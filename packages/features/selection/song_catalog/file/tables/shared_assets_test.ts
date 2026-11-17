// 共有の表の読み込み。ファイルを読まず、組み立てた文字列で確かめる。

import { assertEquals, assertThrows } from "@std/assert";
import { parseSharedAssets } from "./shared_assets.ts";

Deno.test("世代・管理名・共有するPBの曲の管理名を読む", () => {
  assertEquals(
    parseSharedAssets(
      'generation,title,share\ndjt,SAMPLESONG,SAMPLESONG\n9th,"A, B:3",C\n',
    ),
    [
      { generation: "djt", line: 2, share: "SAMPLESONG", title: "SAMPLESONG" },
      { generation: "9th", line: 3, share: "C", title: "A, B:3" },
    ],
  );
});

Deno.test("列名の行が違うとエラーになる", () => {
  assertThrows(
    () => parseSharedAssets("generation,title\n"),
    Error,
    "line 1: unexpected header",
  );
});

Deno.test("空の値がある行はエラーになる", () => {
  assertThrows(
    () => parseSharedAssets("generation,title,share\ndjt,SAMPLESONG,\n"),
    Error,
    "line 2: 3列すべてに値を書く",
  );
});
