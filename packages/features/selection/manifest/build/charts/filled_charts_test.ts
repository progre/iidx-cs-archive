// 表の曲が持たない難易度を、どの裏から出すかを決める。組み立てた裏で確かめる。

import { assertEquals } from "@std/assert";
import { chartFills, type FillBack } from "./filled_charts.ts";

const back = (
  index: number,
  generation: string,
  position: number,
  chartMoves: Record<string, string> = {},
): FillBack => ({ chartMoves, frontIndex: 7, generation, index, position });

/** PB の譜面の枠の難易度名 */
const SLOTS =
  "sp_hyper dp_hyper sp_another dp_another sp_normal dp_normal sp_beginner dp_beginner sp_black dp_black"
    .split(" ");

/** 3rd < 5th < pb の順で後の作品とし、us は最も前にする */
const order = (generation: string) =>
  ["us", "3rd", "5th", "pb"].indexOf(generation);

/** 表の曲(曲index 7)は sp_hyper だけを持つ */
const charts =
  (owned: Record<number, string[]>) => (index: number, name: string) =>
    index === 7 ? name === "sp_hyper" : (owned[index] ?? []).includes(name);

Deno.test("表に無い難易度は、最も後の作品の裏から出し、その裏を鳴らす裏にする", () => {
  const fills = chartFills(
    [back(1, "3rd", 0), back(2, "5th", 1), back(3, "us", 2)],
    charts({ 1: ["sp_normal"], 2: ["sp_normal"], 3: ["sp_normal"] }),
    order,
    SLOTS,
  );
  assertEquals([...fills], [[2, {
    added: { sp_normal: "sp_normal" },
    forcedBack: true,
  }]]);
});

Deno.test("鳴らす裏に無い難易度は、番号が最も小さい候補の裏から出す", () => {
  const fills = chartFills(
    [back(1, "3rd", 0), back(2, "5th", 1)],
    charts({ 1: ["sp_normal", "dp_normal"], 2: ["sp_normal"] }),
    order,
    SLOTS,
  );
  assertEquals(fills.get(2), {
    added: { sp_normal: "sp_normal" },
    forcedBack: true,
  });
  assertEquals(fills.get(1), { added: { dp_normal: "dp_normal" } });
});

Deno.test("鳴らす裏がほかの裏から出す難易度の候補にもなるなら、すべて先頭の候補から出す", () => {
  // dp_normal は 3rd が chart_moves で出す。5th も dp_normal を持つので、5th を鳴らす裏にできない
  const fills = chartFills(
    [
      back(1, "3rd", 0, { dp_normal: "dp_hyper" }),
      back(2, "5th", 1),
    ],
    charts({ 1: ["sp_normal", "dp_hyper"], 2: ["sp_normal", "dp_normal"] }),
    order,
    SLOTS,
  );
  assertEquals([...fills], [[1, { added: { sp_normal: "sp_normal" } }]]);
});

Deno.test("DP BEGINNERと、chart_movesでほかの難易度に出している譜面は使わない", () => {
  const fills = chartFills(
    [back(1, "3rd", 0, { sp_normal: "sp_another" })],
    charts({ 1: ["sp_another", "dp_beginner", "dp_normal"] }),
    order,
    SLOTS,
  );
  assertEquals([...fills], [[1, {
    added: { dp_normal: "dp_normal" },
    forcedBack: true,
  }]]);
});

Deno.test("表の曲が持つ難易度の chart_moves は、鳴らす裏の選び方に関わらない", () => {
  // sp_hyper は表の曲が持つので、3rd の組は裏の中で移すだけである
  const fills = chartFills(
    [back(1, "3rd", 0, { sp_hyper: "sp_normal" }), back(2, "5th", 1)],
    charts({ 1: ["sp_normal"], 2: ["sp_hyper", "dp_normal"] }),
    order,
    SLOTS,
  );
  assertEquals([...fills], [[2, {
    added: { dp_normal: "dp_normal" },
    forcedBack: true,
  }]]);
});
