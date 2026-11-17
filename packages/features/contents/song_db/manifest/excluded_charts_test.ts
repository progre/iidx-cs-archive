import { assertEquals } from "@std/assert";
import { PB_FORMAT as PB_ENTRY } from "../pb/mod.ts";
import type { ManifestAsset } from "@csa/core";
import { withoutCharts } from "./excluded_charts.ts";

const chartAsset = (...names: string[]): ManifestAsset => ({
  kind: "chart",
  references: names.map((name) => ({
    fieldOffset: PB_ENTRY.chartFieldOffset(name),
    width: "u32",
  })),
  sourceArchive: "A",
  sourceFileIndex: 1,
  sourceOffset: 0,
  sourceSize: 1,
});

Deno.test("譜面の資産は、指す欄が無くなったときだけ外す", () => {
  const assets = withoutCharts(
    PB_ENTRY,
    [chartAsset("sp_another"), chartAsset("sp_hyper", "sp_black")],
    ["sp_another", "sp_black"],
  );
  assertEquals(
    assets.map((asset) =>
      asset.references.map((reference) => reference.fieldOffset)
    ),
    [[PB_ENTRY.chartFieldOffset("sp_hyper")]],
  );
});
