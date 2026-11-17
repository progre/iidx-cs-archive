// 全曲リストの`front_charts`の組を、表の曲が持つ難易度かどうかで分ける。組み立てた曲で確かめる。

import { assertEquals } from "@std/assert";
import type { ManifestVariant } from "@csa/core";
import { withMovedCharts } from "./moved_charts.ts";

interface Song {
  title?: string;
  variantOf?: ManifestVariant;
}

const back = (frontCharts: Record<string, string>): Song => ({
  variantOf: { frontCharts, rule: "custom", targetSongIndex: 7 },
});

/** 表の曲(曲index 7)は sp_hyper だけを持つ */
const hasChart = (index: number, name: string) =>
  index === 7 && name === "sp_hyper";

Deno.test("表の曲が持つ難易度の組は movedCharts に、持たない組は frontCharts に分ける", () => {
  const [song] = withMovedCharts(
    [back({ sp_beginner: "sp_beginner", sp_hyper: "sp_normal" })],
    hasChart,
  );
  assertEquals(song.variantOf, {
    frontCharts: { sp_beginner: "sp_beginner" },
    movedCharts: { sp_hyper: "sp_normal" },
    rule: "custom",
    targetSongIndex: 7,
  });
});

Deno.test("表の曲が持つ難易度の組だけなら、frontCharts を持たない", () => {
  const [song] = withMovedCharts([back({ sp_hyper: "sp_normal" })], hasChart);
  assertEquals(song.variantOf, {
    movedCharts: { sp_hyper: "sp_normal" },
    rule: "custom",
    targetSongIndex: 7,
  });
});

Deno.test("表の曲が持たない難易度の組だけなら、変えない", () => {
  const songs: Song[] = [back({ sp_beginner: "sp_beginner" }), { title: "表" }];
  assertEquals(withMovedCharts(songs, hasChart), songs);
});
