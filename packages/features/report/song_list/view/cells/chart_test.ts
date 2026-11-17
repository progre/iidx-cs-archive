import { assertEquals } from "@std/assert";
import type { Chart } from "../../types.ts";
import { chartView, compareText } from "./chart.ts";

const one = (chart: Chart) =>
  chartView({ charts: { sp_hyper: chart } }, "sp_hyper");

Deno.test("補正で変わったレベルは、補正前→補正後の形にする", () => {
  assertEquals(one({ before: 5, level: 3, notes: 321 }), {
    classes: "",
    parts: [{ classes: "", level: "5→3", notes: 321 }],
  });
});

Deno.test("譜面が1つの欄は欄に、2つの欄は譜面ごとに色を付ける", () => {
  assertEquals(
    one({ level: 2, linked: true, notes: 9 }).classes,
    "text-body-tertiary",
  );
  const print = (result: "layout" | number) => ({
    all: "a",
    moved: { sp_normal: { against: "pb:1", result: 1 } },
    notes: "a",
    compare: { against: "pb:1", result },
  });
  const view = chartView(
    {
      charts: {
        sp_normal: {
          excluded: true,
          level: 1,
          notes: 83,
          print: print("layout"),
        },
      },
      movedIn: {
        sp_normal: {
          from: { chart: "sp_hyper" },
          level: 1,
          notes: 99,
          print: print("layout"),
        },
      },
    },
    "sp_normal",
    (name) => name === "sp_hyper" ? "SH" : "?",
  );
  assertEquals(view.classes, undefined);
  assertEquals(
    view.parts?.map((
      { classes, compare, from },
    ) => [classes, compare, from?.text]),
    [
      ["", "100%", "🔗 SH"],
      ["text-bg-dark border-top", "配置不一致", undefined],
    ],
  );
});

Deno.test("ほかの曲から入る譜面は、出どころの世代を書く", () => {
  const view = chartView(
    {
      charts: {},
      movedIn: {
        sp_beginner: {
          from: { chart: "sp_beginner", generation: "6th" },
          level: 1,
          notes: 9,
        },
      },
    },
    "sp_beginner",
    () => "SB",
  );
  assertEquals(view.parts?.at(0)?.from?.text, "🔗 6th SB");
});

Deno.test("外した譜面の欄に、比較結果と「DHと同一」を別々に書く", () => {
  const compare = { against: "pb:1", result: "layout" as const };
  const chart = (all: string, excluded?: true) => ({
    ...(excluded ? { excluded } : {}),
    level: 1,
    notes: 99,
    print: { all, compare, notes: "x" },
  });
  const charts = {
    dp_hyper: chart("a"),
    dp_normal: chart("a", true),
    sp_hyper: chart("b", true),
    sp_normal: chart("b", true),
  };
  const labelOf = (name: string) => name === "dp_hyper" ? "DH" : name;
  const partOf = (name: string) =>
    chartView({ charts }, name, labelOf).parts?.at(0);
  assertEquals(
    [partOf("dp_normal")?.compare, partOf("dp_normal")?.sameAs],
    ["配置不一致", "DHと同一"],
  );
  assertEquals(partOf("sp_normal")?.sameAs, undefined);
});

Deno.test("別の版の別の難易度で同じ譜面を、先頭の1つと残りの数で書く", () => {
  const sameInOf = (sameIn: string[]) =>
    chartView(
      {
        charts: {
          dp_another: {
            level: 4,
            notes: 337,
            print: { all: "a", notes: "a", sameIn },
          },
        },
      },
      "dp_another",
      (name) => name === "dp_hyper" ? "DH" : "SH",
    ).parts?.at(0)?.sameIn;
  assertEquals(sameInOf(["7th:47/dp_hyper"]), {
    text: "7th DHと同一",
    title: "7th:47 DH",
  });
  assertEquals(sameInOf(["7th:47/dp_hyper", "us:3/sp_hyper"]), {
    text: "7th DHほか1譜面と同一",
    title: "7th:47 DH、us:3 SH",
  });
});

Deno.test("譜面が無い難易度は、無いことを示す", () => {
  assertEquals(chartView({ charts: {} }, "sp_hyper"), { none: true });
});

Deno.test("表に選んだ版と比べて、一致した割合か不一致の理由を書く", () => {
  const compare = (result: "bpm" | "layout" | number) => ({
    against: "pb:1",
    result,
  });
  assertEquals(compareText(compare(1)), "100%");
  assertEquals(compareText(compare(0.9996)), "99.9%");
  assertEquals(compareText(compare("layout")), "配置不一致");
  assertEquals(compareText(compare("bpm")), "BPM不一致");
  assertEquals(compareText(undefined), undefined);
});
