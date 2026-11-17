// 書いても効かない難易度の検知。実データを使わず、組み立てた行と原作の値で確かめる。
// 実行: deno test packages/features/selection/song_catalog/levels/audit_test.ts

import type { CatalogMatch } from "../../match.ts";
import type { CatalogRow } from "../../file/mod.ts";
import { auditLevels, type SongOriginal } from "./audit.ts";

function assertJson(actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`${a} != ${e}`);
  }
}

function match(songId: number, levels: CatalogRow["levels"]): CatalogMatch {
  return {
    row: {
      line: songId + 2,
      name: "A" + songId,
      songId: null,
      indexTitle: null,
      edition: null,
      genre: null,
      fullTitle: null,
      subtitle: null,
      artist: null,
      folder: null,
      levels,
      excludedCharts: [],
      exclude: false,
      note: null,
    },
    song: { songId, title: "A" + songId },
  };
}

const ORIGINAL: SongOriginal = {
  levels: { sn: 5, sh: 8 },
  charts: ["sn", "sh", "dn"],
};

Deno.test("原作と同じ値を書いた譜面をsameLevelで報告する", () => {
  const reports = auditLevels(
    [match(0, { sn: 5, sh: 9 })],
    new Map([[0, ORIGINAL]]),
  );
  assertJson(
    reports.map((r) => [r.kind, r.row.name, r.charts]),
    [["sameLevel", "A0", ["sn"]]],
  );
});

Deno.test("曲に無い譜面へ書いた値をnoChartで報告する", () => {
  const reports = auditLevels(
    [match(0, { sh: 9, sa: 10, dl: 12 })],
    new Map([[0, ORIGINAL]]),
  );
  assertJson(
    reports.map((r) => [r.kind, r.charts]),
    [["noChart", ["sa", "dl"]]],
  );
});

Deno.test("原作の値を読めない譜面は、同じとみなさない", () => {
  const reports = auditLevels(
    [match(0, { dn: 5 })],
    new Map([[0, ORIGINAL]]),
  );
  assertJson(reports, []);
});

Deno.test("値を書いていない曲と、原作を調べていない曲は報告しない", () => {
  assertJson(auditLevels([match(0, {})], new Map([[0, ORIGINAL]])), []);
  assertJson(auditLevels([match(1, { sn: 5 })], new Map([[0, ORIGINAL]])), []);
});
