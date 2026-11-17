import { assertEquals, assertRejects } from "@std/assert";
import { listrProgress } from "./progress.ts";

Deno.test("工程を順に実行し、結果を返す", async () => {
  const progress = listrProgress(["a", "b"], String, () => [], "silent");
  const order: string[] = [];
  const first = await progress.stage("a", () => {
    order.push("a");
    return Promise.resolve(1);
  });
  const second = await progress.stage("b", () => {
    order.push("b");
    return Promise.resolve(2);
  });
  await progress.finish();
  assertEquals(order, ["a", "b"]);
  assertEquals([first, second], [1, 2]);
});

Deno.test("止まった後の工程は、開始を待たずにエラーにする", async () => {
  const progress = listrProgress(["a", "b"], String, () => [], "silent");
  await assertRejects(
    () => progress.stage("a", () => Promise.reject(new Error("failed"))),
  );
  await assertRejects(
    () => progress.stage("b", () => Promise.resolve()),
    Error,
    "failed",
  );
});
