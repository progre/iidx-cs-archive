import { assertEquals } from "@std/assert";
import { isProgressStep } from "./progress.ts";

const stepsOf = (total: number) =>
  Array.from({ length: total }, (_, i) => i + 1)
    .filter((done) => isProgressStep(done, total));

Deno.test("件数が多いときは、1%進むごとに1回だけ真になる", () => {
  const steps = stepsOf(1000);
  assertEquals(steps.length, 100);
  assertEquals(steps.at(-1), 1000);
});

Deno.test("件数が100に満たないときは、毎回真になる", () => {
  assertEquals(stepsOf(3), [1, 2, 3]);
});
