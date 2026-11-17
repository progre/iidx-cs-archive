// どの曲も指さなくなった原盤の領域へ、収まる資産から先に置く。

import { createPlacementPlan } from "./build.ts";
import { assertEquals, fixture, planInput } from "./testing.ts";

Deno.test("新規資産は原盤の空いた領域へ先に置き、溢れた分を終端へ連ねる", () => {
  const plan = createPlacementPlan(fixture(), {
    ...planInput,
    reusableRanges: [{ endLba: 12, startLba: 10 }],
  });
  assertEquals(
    plan.assets.map(({ lba }) => lba).join(" "),
    "10 11 100",
    "空いた領域の2セクターへ2件、残りは終端",
  );
  assertEquals(plan.assetRange.startLba, 100, "終端に連ねた範囲の先頭");
  assertEquals(plan.assetRange.endLba, 101, "終端に連ねた範囲の末尾");
  assertEquals(plan.reusedRanges.length, 1, "空いた領域");
});

Deno.test("原盤の外を指す空いた領域は停止する", () => {
  let message = "";
  try {
    createPlacementPlan(fixture(), {
      ...planInput,
      reusableRanges: [{ endLba: 101, startLba: 99 }],
    });
  } catch (error) {
    message = String(error);
  }
  if (!message.includes("原盤の空いた領域が原盤の外にある")) {
    throw new Error(`原盤の外の領域で停止しなかった: ${message}`);
  }
});
