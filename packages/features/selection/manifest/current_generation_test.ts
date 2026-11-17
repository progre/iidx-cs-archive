import { assertEquals } from "@std/assert";
import { forCurrentGeneration } from "./by_generation.ts";

Deno.test("同じ世代を続けて引く間は、作り直さない", () => {
  const made: string[] = [];
  const get = forCurrentGeneration((generation) => {
    made.push(generation);
    return generation + made.length;
  });
  assertEquals([get("3rd"), get("3rd"), get("4th"), get("3rd")], [
    "3rd1",
    "3rd1",
    "4th2",
    "3rd3",
  ]);
});
