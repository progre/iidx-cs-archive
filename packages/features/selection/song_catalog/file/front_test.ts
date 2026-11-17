// 全曲リストの front・front_charts・front_rule の3列の読み込み。組み立てた値で確かめる。

import { assertEquals, assertThrows } from "@std/assert";
import { frontOf } from "./front.ts";

const LINE = 2;

Deno.test("3列とも空なら扱いを持たない", () => {
  assertEquals(frontOf(["", "", ""], LINE), undefined);
});

Deno.test("frontに*以外を書くとエラーになる", () => {
  assertThrows(
    () => frontOf(["x", "", ""], LINE),
    Error,
    "line 2: frontには*を書く",
  );
});

Deno.test("front_chartsを読む", () => {
  assertEquals(frontOf(["", "sl=sa dl=da", ""], LINE), {
    charts: { sl: "sa", dl: "da" },
  });
});

Deno.test("front_ruleは、差し替えの条件と直前に演奏する曲と5鍵盤版を読む", () => {
  assertEquals(
    ["random8", "previousSong=A:3", "five_keys"].map((rule) =>
      frontOf(["", "", rule], LINE)
    ),
    [
      { rule: { kind: "random8" } },
      { rule: { after: "A:3", kind: "previousSong" } },
      { fiveKeys: true },
    ],
  );
});

Deno.test("front_ruleに知らない条件を書くとエラーになる", () => {
  for (const rule of ["custom", "previousSong", "always=A"]) {
    assertThrows(
      () => frontOf(["", "", rule], LINE),
      Error,
      `line 2: front_ruleの${rule}が読めない`,
    );
  }
});

Deno.test("front_ruleを書いた行に front か front_charts を書くとエラーになる", () => {
  assertThrows(
    () => frontOf(["", "sl=sa", "always"], LINE),
    Error,
    "line 2: front_ruleを書いた行には、front_chartsを書けない",
  );
  assertThrows(
    () => frontOf(["*", "", "five_keys"], LINE),
    Error,
    "line 2: front_ruleを書いた行は、組の表にできない",
  );
});

Deno.test("five_keysの行には front_charts を書ける", () => {
  assertEquals(frontOf(["", "sh=sn", "five_keys"], LINE), {
    charts: { sh: "sn" },
    fiveKeys: true,
  });
});

Deno.test("front_chartsで SP と DP をまたぐとエラーになる", () => {
  assertThrows(
    () => frontOf(["", "sl=da", ""], LINE),
    Error,
    "line 2: front_chartsのsl=daが読めない",
  );
});
