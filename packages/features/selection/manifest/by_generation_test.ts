import { assertEquals } from "@std/assert";
import { mapByGeneration } from "./by_generation.ts";

Deno.test("世代ごとにまとめた順で呼び、結果は元の並びで返す", () => {
  const items = ["a1", "b1", "a2", "b2"];
  const called: string[] = [];
  const results = mapByGeneration(
    items,
    (item) => item[0],
    (item, index) => {
      called.push(item);
      return `${item}:${index}`;
    },
  );
  assertEquals(called, ["a1", "a2", "b1", "b2"]);
  assertEquals(results, ["a1:0", "b1:1", "a2:2", "b2:3"]);
});
