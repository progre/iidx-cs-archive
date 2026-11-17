// 実行: deno test packages/features/layout/iso_plan/plan/report/plan_lines_test.ts
// 配置計画は合成したデータで与える。データには、記録の行を作るのに使う値だけを入れる。

import { assertEquals } from "@std/assert";
import { planLines, type PlanLinesInput } from "./plan_lines.ts";

const SONG_LIST_REPORT = "song_list.html";

const plannedOf = (legacyIncomplete: string[]): PlanLinesInput =>
  ({
    elfPlacement: { volumeSectors: 900 },
    imageSets: {
      files: [{ summary: "a.if" }],
      legacyIncomplete,
    },
    manifest: { songs: [1, 2] },
    overlayPlan: {
      limitSectors: 10,
      maxSectors: 8,
      overLimit: 0,
      packages: 3,
      songs: 2,
    },
    plan: {
      assetRange: { endLba: 120, startLba: 100 },
      assets: [1, 2, 3],
      data1: { titleCards: [1] },
      placements: [1, 2],
      reusedRanges: [{ endLba: 20, startLba: 10 }],
      targetSongCount: 2,
    },
    prepared: { summaries: ["要約A"] },
    relocations: [{ fromLba: 5, name: "X", sectors: 4, toLba: 9 }],
  }) as unknown as PlanLinesInput;

Deno.test("計画の行は、一覧のパス、要約、件数、領域、画像セット、移動の順に並ぶ", () => {
  assertEquals(planLines(plannedOf([]), SONG_LIST_REPORT), [
    `song list: ${SONG_LIST_REPORT}`,
    "要約A",
    "2 slots: 2 songs / ABC 2 (references 3) / title cards 1 / volume 900 sectors",
    "overlays: 2 songs / packages 3 / max 8 sectors / over 10: 0",
    "new assets: 100..120 (40960 bytes)",
    "freed source range 10..20: 0 (0 sectors)",
    "image set a.if",
    "X: 5 -> 9 (4 sec)",
  ]);
});

Deno.test("legacyで枠を埋められない曲があれば、画像セットの後に件数と名前を足す", () => {
  const lines = planLines(plannedOf(["s1", "s2"]), SONG_LIST_REPORT);
  assertEquals(lines[6], "image set a.if");
  assertEquals(lines[7], "songs with incomplete legacy slots 2: s1, s2");
});
