// 全曲リストと曲DBの照合結果のまとめ。ファイルを読まず、組み立てた文字列で確かめる。
// 実行: deno test packages/features/selection/song_catalog/review_test.ts

import {
  catalogPathsOf,
  type DbContent,
  generationOfCatalogFile,
  removeSameLevels,
  reviewCatalog,
  strayFileLines,
} from "./review.ts";
import { CATALOG_HEADER } from "./file/mod.ts";

function assertJson(actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`${a} != ${e}`);
  }
}

/** 索引の曲名からchart_movesまでの11列を空にして、難易度10列を並べ、excludeとnoteを空にした行 */
function rowOf(title: string, levels: Record<string, number>): string {
  const charts = "sb sn sh sa sl db dn dh da dl".split(" ");
  const cells = charts.map((chart) => String(levels[chart] ?? ""));
  return [title, ...Array(11).fill(""), ...cells, "", ""].join(",");
}

function catalogOf(...rows: string[]): string {
  return [CATALOG_HEADER, ...rows].join("\n") + "\n";
}

const CONTENT: DbContent = {
  songs: [{ songId: 0, title: "A0" }, { songId: 1, title: "A1" }],
  originals: new Map([
    [0, { levels: { sn: 3, sh: 8 }, charts: ["sh", "sn"] }],
    [1, { levels: {}, charts: [] }],
  ]),
};

Deno.test("リストのファイル名から世代を取り出す", () => {
  assertJson(generationOfCatalogFile("05_8th.csv"), "8th");
  assertJson(generationOfCatalogFile("readme.md"), undefined);
});

Deno.test("定義に無い世代のファイルを報告する", () => {
  const paths = new Map([["8th", "a/05_8th.csv"], ["zzz", "a/99_zzz.csv"]]);
  assertJson(strayFileLines(paths, ["8th"]), [
    "a/99_zzz.csv: unknown generation",
  ]);
});

Deno.test("問題が無いリストは、報告の行を返さない", () => {
  const text = catalogOf(rowOf("A0", { sh: 9 }), rowOf("A1", {}));
  assertJson(reviewCatalog("hs", text, CONTENT).lines, []);
});

Deno.test("リストに無い曲と、効かない難易度を行にする", () => {
  const text = catalogOf(rowOf("A0", { sn: 3, sh: 9, sa: 10 }));
  assertJson(reviewCatalog("hs", text, CONTENT).lines, [
    "hs missing: A1",
    "hs sameLevel: A0(sn)",
    "hs noChart: A0(sa)",
  ]);
});

Deno.test("原作と同じ難易度だけをリストから消す", () => {
  const text = catalogOf(rowOf("A0", { sn: 3, sh: 9 }), rowOf("A1", {}));
  const { levelReports } = reviewCatalog("hs", text, CONTENT);
  assertJson(
    removeSameLevels(text, levelReports),
    catalogOf(rowOf("A0", { sh: 9 }), rowOf("A1", {})),
  );
});

Deno.test("リストのパスは、世代で引く。リストでないファイルは含めない", () => {
  assertJson(
    [...catalogPathsOf("d/", ["05_8th.csv", "readme.md", "06_9th.csv"])],
    [["8th", "d/05_8th.csv"], ["9th", "d/06_9th.csv"]],
  );
});
