import { assertEquals } from "@std/assert";
import { asset, songDraft } from "../testing.ts";
import {
  brokenPairsOf,
  undefinedChartExclusionsOf,
  undefinedSharesOf,
} from "./partners.ts";

const chart = [asset("chart", "source")];

Deno.test("参照先が収録される組は、壊れていない", () => {
  const rows = [
    songDraft("dd", 79, chart),
    songDraft("dd", 97, chart, { fiveKeyOf: { songId: 79 } }),
  ];
  assertEquals(brokenPairsOf(rows), []);
});

Deno.test("5鍵盤版の表を外すと、壊れた組として返す", () => {
  const rows = [
    songDraft("dd", 79, chart, { excluded: true }),
    songDraft("dd", 97, chart, { fiveKeyOf: { songId: 79 } }),
  ];
  assertEquals(brokenPairsOf(rows), ["dd/97 → dd/79"]);
});

Deno.test("裏エントリーの差し替え元が全曲リストに無いと、壊れた組として返す", () => {
  const rows = [
    songDraft("dd", 96, chart, {
      variantOf: { rule: "alternate", songId: 40 },
    }),
  ];
  assertEquals(brokenPairsOf(rows), ["dd/96 → dd/40"]);
});

Deno.test("外した行の参照先は調べない", () => {
  const rows = [
    songDraft("dd", 97, chart, {
      excluded: true,
      fiveKeyOf: { songId: 79 },
    }),
  ];
  assertEquals(brokenPairsOf(rows), []);
});

const charts = (...names: string[]) =>
  names.map((name) => ({
    ...asset("chart", "source"),
    fields: Array.of(name),
  }));

Deno.test("譜面を外せる行は、検査で何も返さない", () => {
  const rows = Array.of(
    songDraft("9th", 1, charts("sp_hyper", "sp_another"), {
      excludedCharts: Array.of("sp_another"),
    }),
  );
  assertEquals(undefinedChartExclusionsOf(rows), Array.of());
});

Deno.test("全部の譜面を外すと理由を返し、曲に無い譜面のxは数えない", () => {
  const rows = [
    songDraft("9th", 1, charts("sp_hyper", "sp_another"), {
      excludedCharts: ["sp_hyper", "dp_black"],
    }),
    songDraft("9th", 2, charts("sp_hyper"), {
      excludedCharts: ["sp_hyper", "dp_black"],
    }),
  ];
  assertEquals(undefinedChartExclusionsOf(rows), ["9th/2 全部の譜面を外した"]);
});

Deno.test("5鍵盤版の組に入る曲の譜面を外すと、理由を返す", () => {
  const rows = Array.of(
    songDraft("dd", 79, charts("sp_hyper", "sp_another"), {
      excludedCharts: Array.of("sp_another"),
    }),
    songDraft("dd", 97, charts("sp_hyper"), { fiveKeyOf: { songId: 79 } }),
  );
  assertEquals(
    undefinedChartExclusionsOf(rows),
    Array.of(
      "dd/79 5鍵盤版か裏エントリーの組に入る",
    ),
  );
});

Deno.test("PB原盤の曲を表にする裏エントリーは、同じ世代の同じsong_idを相手にしない", () => {
  const rows = [
    songDraft("hs", 34, chart, { excluded: true }),
    songDraft("hs", 51, chart, {
      variantOf: { generation: "pb", rule: "alternate", songId: 34 },
    }),
  ];
  assertEquals(brokenPairsOf(rows), []);
});

Deno.test("shareは、外した曲と、5鍵盤版か裏エントリーの組に入る曲には書けない", () => {
  const rows = [
    songDraft("dd", 1, chart, { excluded: true, share: "A" }),
    songDraft("dd", 79, chart, { share: "B" }),
    songDraft("dd", 97, chart, { fiveKeyOf: { songId: 79 } }),
    songDraft("dd", 5, chart, { share: "C" }),
  ];
  assertEquals(undefinedSharesOf(rows), [
    "dd/1 excludeを書いた行に共有を書いた",
    "dd/79 5鍵盤版か裏エントリーの組に入る",
  ]);
});
