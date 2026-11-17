import { assertEquals } from "@std/assert";
import { chartKeyRuleOf } from "../songmap/mod.ts";
import { chartFileIndices, GENERATIONS, songDbPath } from "./generations.ts";

Deno.test("素材世代は発売順で、PBを含まない", () => {
  assertEquals(GENERATIONS.slice(0, 2), ["3rd", "4th"]);
  assertEquals(GENERATIONS.at(-1), "emp");
  assertEquals(GENERATIONS.includes("pb"), false);
});

Deno.test("曲DBのエントリを写せるのは、1件の長さがPBと同じdjtとempだけである", () => {
  assertEquals(
    [...GENERATIONS, "pb"].filter((g) => songDbPath(g) === "copy"),
    ["djt", "emp"],
  );
});

Deno.test("鍵の規則は、gold・djt・emp・pbだけが持つ", () => {
  assertEquals(
    ["9th", "red", "dd", "gold", "djt", "emp", "pb"].map((generation) =>
      chartKeyRuleOf(generation) !== null
    ),
    [false, false, false, true, true, true, true],
  );
});

Deno.test("どの規則にも、10個の文字列の位置と、鍵の16文字の取り方がある", () => {
  for (const generation of ["gold", "djt", "emp", "pb"]) {
    const rule = chartKeyRuleOf(generation)!;
    assertEquals(rule.offsets.length, 10, generation);
    assertEquals(rule.picks.length, 16, generation);
  }
});

Deno.test("譜面のファイルは、.plyのファイルを参照している", () => {
  const files = [
    { refs: ["A [SP HYPER].ply"] },
    { refs: [] },
    { refs: ["A [0].wvb", "A [1].PLY"] },
    { refs: ["A.if"] },
  ];
  assertEquals(chartFileIndices(files), [0, 2]);
});
