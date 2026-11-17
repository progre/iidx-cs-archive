import { assertEquals } from "@std/assert";
import { levelsByDifficulty } from "./difficulty_names.ts";

Deno.test("値がある譜面だけを、列の並びで難易度名にする", () => {
  assertEquals(levelsByDifficulty({ dh: 9, sn: 5 }), [
    ["sp_normal", 5],
    ["dp_hyper", 9],
  ]);
});

Deno.test("値が無ければ空にする", () => {
  assertEquals(levelsByDifficulty({}), []);
});
