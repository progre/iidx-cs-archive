import { assertEquals, assertThrows } from "@std/assert";
import type { IndividualAssetManifest } from "@csa/core";
import { assertSameKeysoundBank, era1ChartTargets } from "./charts.ts";

const manifestOf = (
  songs: { generation: string; kinds: string[] }[],
  sources: string[],
): IndividualAssetManifest =>
  ({
    songs: songs.map((song, index) => ({
      assets: song.kinds.map((kind, each) => ({
        kind,
        references: [{ fieldOffset: 0xc0 + each * 4 }],
        sourceFileIndex: 100 + each,
      })),
      sourceGeneration: song.generation,
      sourceSongIndex: index,
      title: `曲${index}`,
    })),
    sources: Object.fromEntries(sources.map((name) => [name, {}])),
  }) as unknown as IndividualAssetManifest;

Deno.test("era1ChartTargets は指定の世代の譜面資産だけを返す", () => {
  const manifest = manifestOf(
    [
      { generation: "5th", kinds: ["chart", "sound", "chart"] },
      { generation: "9th", kinds: ["chart"] },
    ],
    ["5th", "9th"],
  );
  const targets = era1ChartTargets(manifest, "5th");
  assertEquals(
    targets.map((t) => [t.generation, t.fieldOffset, t.sourceFileIndex]),
    [["5th", 0xc0, 100], ["5th", 0xc8, 102]],
  );
});

Deno.test("同じ譜面は、同じキー音バンクなら変換できる。違えば失敗する", () => {
  assertSameKeysoundBank("a", 3, 3);
  assertThrows(() => assertSameKeysoundBank("a", 2, 3), Error, "バンク2");
});
