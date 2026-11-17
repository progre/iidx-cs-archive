import { assertEquals } from "@std/assert";
import { LaterUses } from "./later_uses.ts";

Deno.test("同じ鍵は1度だけ作り、最後に使った後は持たない", async () => {
  const made: string[] = [];
  const uses = new LaterUses<string>(["a", "b", "a"]);
  const take = (key: string) =>
    uses.take(key, () => {
      made.push(key);
      return Promise.resolve(key.toUpperCase());
    });
  const values = [await take("a"), await take("b"), await take("a")];
  assertEquals(values, ["A", "B", "A"]);
  assertEquals(made, ["a", "b"]);
  assertEquals(uses.keptCount, 0);
});
