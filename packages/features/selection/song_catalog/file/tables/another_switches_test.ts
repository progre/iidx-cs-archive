// ANOTHERで使い分ける素材の表の読み込み。ファイルを読まず、組み立てた文字列で確かめる。

import { assertEquals, assertThrows } from "@std/assert";
import { parseAnotherSwitches } from "./another_switches.ts";

const HEADER = "generation,title,video,overlay,title_card\n";

Deno.test("ムービー・オーバーレイ・曲名カードの指定を読む。空の欄は指定なしになる", () => {
  assertEquals(
    parseAnotherSwitches(`${HEADER}red,EMM,835,another,1\nhs,LID,,,1\n`),
    [
      {
        generation: "red",
        line: 2,
        overlayOnlyAnother: true,
        title: "EMM",
        titleCardSprite: 1,
        video: 835,
      },
      {
        generation: "hs",
        line: 3,
        overlayOnlyAnother: false,
        title: "LID",
        titleCardSprite: 1,
        video: null,
      },
    ],
  );
});

Deno.test("列名の行が違うとエラーになる", () => {
  assertThrows(
    () => parseAnotherSwitches("generation,title\n"),
    Error,
    "line 1: unexpected header",
  );
});

Deno.test("指定が1つも無い行はエラーになる", () => {
  assertThrows(
    () => parseAnotherSwitches(`${HEADER}red,EMM,,,\n`),
    Error,
    "line 2: video・overlay・title_cardのどれかに値を書く",
  );
});

Deno.test("overlayにanother以外を書くとエラーになる", () => {
  assertThrows(
    () => parseAnotherSwitches(`${HEADER}red,EMM,,all,\n`),
    Error,
    "line 2: overlayの値は、anotherか空にする",
  );
});

Deno.test("番号の欄に整数でない値を書くとエラーになる", () => {
  assertThrows(
    () => parseAnotherSwitches(`${HEADER}red,EMM,8x5,,\n`),
    Error,
    "line 2: videoは0以上の整数",
  );
});
