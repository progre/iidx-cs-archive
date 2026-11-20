// 裏の曲の`chartMoves`のうち、表の曲が持たない難易度へ移す組を`frontFills`に書く。組み立てた曲で確かめる。

import { assertEquals } from "@std/assert";
import type { ManifestVariant } from "@csa/core";
import { withFrontFills } from "./front_fills.ts";

interface Song {
  title?: string;
  variantOf?: ManifestVariant;
}

const back = (chartMoves: Record<string, string>): Song => ({
  variantOf: { chartMoves, rule: "custom", targetSongIndex: 7 },
});

/** 表の曲(曲index 7)は sp_hyper だけを持つ */
const hasChart = (index: number, name: string) =>
  index === 7 && name === "sp_hyper";

Deno.test("表の曲が持たない難易度へ移す組の移し先を、frontFills に書く", () => {
  const [song] = withFrontFills(
    [back({ sp_beginner: "sp_beginner", sp_hyper: "sp_normal" })],
    hasChart,
  );
  assertEquals(song.variantOf, {
    chartMoves: { sp_beginner: "sp_beginner", sp_hyper: "sp_normal" },
    frontFills: ["sp_beginner"],
    rule: "custom",
    targetSongIndex: 7,
  });
});

Deno.test("表の曲が持つ難易度へ移す組だけなら、変えない", () => {
  const songs: Song[] = [back({ sp_hyper: "sp_normal" }), { title: "表" }];
  assertEquals(withFrontFills(songs, hasChart), songs);
});
