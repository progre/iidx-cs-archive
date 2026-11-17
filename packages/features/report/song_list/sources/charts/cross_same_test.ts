import type { ChartShape } from "@csa/core";
import { assertEquals } from "@std/assert";
import { chartGroupsOf } from "./chart_groups.ts";
import { type ChartOwner, unlinkedSameOf } from "./cross_same.ts";

const shape = (ticks: number[]): ChartShape => ({ keys: { "0.1": ticks } });
const A = shape([0, 100, 200]);
const B = shape([0, 50, 300]);

const shapes: Record<string, Record<string, ChartShape>> = {
  "7th:1": { dp_hyper: A, sp_hyper: B },
  "3rd:2": { dp_another: A, dp_hyper: B, sp_normal: B },
};
const shapesOf = (generation: string, songId: number) =>
  shapes[`${generation}:${songId}`];
const GENERATIONS = ["3rd", "7th"];
const owner = (id: string, rest: Partial<ChartOwner> = {}): ChartOwner => {
  const [generation, songId] = id.split(":");
  return { generation, key: "K", songId: Number(songId), ...rest };
};

Deno.test("難易度をまたいで同じ譜面を、別の版から探す。同じ版の中は探さない", () => {
  const { sameIn } = chartGroupsOf(
    [owner("7th:1"), owner("3rd:2")],
    shapesOf,
    GENERATIONS,
  );
  assertEquals(sameIn.get("3rd:2/dp_another"), ["7th:1/dp_hyper"]);
  assertEquals(sameIn.get("3rd:2/sp_normal"), ["7th:1/sp_hyper"]);
  assertEquals(sameIn.get("3rd:2/dp_hyper"), ["7th:1/sp_hyper"]);
});

Deno.test("移して結んだ譜面は、難易度をまたいで同じでも探さない", () => {
  const { sameIn } = chartGroupsOf(
    [owner("7th:1"), owner("3rd:2", { moves: { dp_hyper: "dp_another" } })],
    shapesOf,
    GENERATIONS,
  );
  assertEquals(sameIn.has("3rd:2/dp_another"), false);
  assertEquals(sameIn.has("7th:1/dp_hyper"), false);
});

Deno.test("どちらも選べる譜面の組だけを、1組1行で書く", () => {
  const owners = [
    owner("7th:1"),
    owner("3rd:2", { excludedCharts: ["sp_normal"] }),
  ];
  const { samePairs } = chartGroupsOf(owners, shapesOf, GENERATIONS);
  assertEquals(unlinkedSameOf(owners, samePairs), [
    "K 3rd:2/dp_another = 7th:1/dp_hyper",
    "K 3rd:2/dp_hyper = 7th:1/sp_hyper",
  ]);
});
