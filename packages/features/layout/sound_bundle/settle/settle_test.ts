import { assertEquals, assertThrows } from "@std/assert";
import type { IndividualAssetManifest } from "@csa/core";
import { SoundOccurrences } from "./settle.ts";
import { settleGeneration } from "./settle.ts";
import { soundTargetsOf } from "../targets.ts";

const asset = (sourceOffset: number) => ({
  kind: "bgm",
  sourceArchive: "a.dat;1",
  sourceFileIndex: sourceOffset,
  sourceOffset,
  sourceSize: 4,
});

const manifestOf = (offsets: number[]) =>
  ({
    songs: [{ assets: offsets.map(asset), sourceGeneration: "gen" }],
  }) as unknown as IndividualAssetManifest;

/** 周回は、offsetが0・4・8の3つの音を、変わらないまま書いた */
function lapOf(): SoundOccurrences {
  const lap = new SoundOccurrences();
  soundTargetsOf(manifestOf([0, 4, 8]), "gen").forEach((target) =>
    lap.add(target, { size: 4 }, true)
  );
  return lap;
}

Deno.test("最終の音が周回の部分列なら、外れた音を除いた範囲と位置になる", () => {
  const manifest = manifestOf([0, 8]);
  const settled = settleGeneration(manifest, "gen", lapOf().list);
  assertEquals(settled.kept, {
    dropped: true,
    kept: [{ offset: 0, size: 4 }, { offset: 8, size: 4 }],
  });
  assertEquals(manifest.songs[0].assets.map((each) => each.sourceOffset), [
    0,
    4,
  ]);
  assertEquals(settled.rows, []);
  assertEquals(settled.summary, "gen converted 0 of 2");
});

Deno.test("外れた音が無ければ、書き直さない", () => {
  const settled = settleGeneration(manifestOf([0, 4, 8]), "gen", lapOf().list);
  assertEquals(settled.kept.dropped, false);
});

Deno.test("最終の音が周回に無ければ例外にする", () => {
  assertThrows(
    () => settleGeneration(manifestOf([12]), "gen", lapOf().list),
    Error,
    "周回で書いた音の並びに無い",
  );
});
