// ムービーの欄の文字の、別名への置き換え。

import { assertEquals } from "@std/assert";
import { movieText } from "./text.ts";

const aliases = new Map([["3rd:315", "2nd_house"], ["pb:1024", "2nd_house"]]);

Deno.test("別名の表にある世代と番号を、別名にする", () => {
  assertEquals(
    movieText("3rd:315 → pb:1024 → 1024", aliases),
    "3rd:2nd_house → pb:2nd_house → 1024",
  );
});

Deno.test("別名の表に無い世代と番号は、そのまま残す", () => {
  assertEquals(
    movieText("pb:1024, pb:1031 → 9th:10241", aliases),
    "pb:2nd_house, pb:1031 → 9th:10241",
  );
});
