// 全曲リストへの難易度の書き込み。実データを使わず、組み立てた文字列で確かめる。
// 実行: deno test packages/features/selection/song_catalog/levels/writing/write_test.ts

import { parse } from "@std/csv";
import { CATALOG_HEADER } from "../../file/mod.ts";
import { applyLevels, catalogKeys } from "./write.ts";

function assertJson(actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`${a} != ${e}`);
  }
}

const COLUMN_COUNT = CATALOG_HEADER.split(",").length;

/** 行末に空の列を補い、列名の行と同じ列の数にそろえる */
const padded = (row: string) =>
  row + ",".repeat(Math.max(0, COLUMN_COUNT - (parse(row)[0]?.length ?? 0)));

const catalogOf = (...rows: string[]) =>
  [CATALOG_HEADER, ...rows.map(padded)].join("\n") + "\n";

Deno.test("書く譜面の列だけを変え、ほかの列は変えない", () => {
  const before = catalogOf(
    "A,,,G,F,S,R,6th",
    "B" + ",".repeat(20),
  );
  const result = applyLevels(
    before,
    new Map([["A", { sn: 4, dh: 10 }]]),
  );
  assertJson(
    result.text,
    catalogOf(
      "A,,,G,F,S,R,6th,,,,,,4,,,,,,10,,,,",
      "B" + ",".repeat(20),
    ),
  );
  assertJson(result.changed, 2);
});

Deno.test('`,`や`"`を含む値は、`"`で囲んだまま書き戻す', () => {
  const result = applyLevels(
    catalogOf('"A,B",,,,"x ""y"""'),
    new Map([["A,B", { sn: 4 }]]),
  );
  assertJson(
    result.text,
    catalogOf('"A,B",,,,"x ""y"""' + ",".repeat(9) + "4"),
  );
});

Deno.test("同じ値を書いても変更に数えない", () => {
  const before = catalogOf("A" + ",".repeat(13) + "4");
  const result = applyLevels(before, new Map([["A", { sn: 4 }]]));
  assertJson(result.text, before);
  assertJson(result.changed, 0);
});

Deno.test("`:{song_id}`付きの管理名と、空白だけの管理名をキーで引く", () => {
  const result = applyLevels(
    catalogOf("A:12", " :87"),
    new Map([["A:12", { sb: 3 }], [":87", { sb: 5 }]]),
  );
  assertJson(
    result.text,
    catalogOf("A:12" + ",".repeat(12) + "3", " :87" + ",".repeat(12) + "5"),
  );
});

Deno.test("列名の行と、キーに無い行は変えず、行が無いキーを返す", () => {
  const before = catalogOf("A", "B");
  const result = applyLevels(before, new Map([["C", { sb: 1 }]]));
  assertJson(result.text, before);
  assertJson(result.missing, ["C"]);
});

Deno.test("全曲リストの行のキーを返す", () => {
  assertJson(
    Array.from(catalogKeys(catalogOf("A", "B:3", " :87"))),
    ["A", "B:3", ":87"],
  );
});

Deno.test("値がnullの譜面は、列を空にする", () => {
  const result = applyLevels(
    catalogOf("A" + ",".repeat(13) + "4,10"),
    new Map([["A", { sn: null }]]),
  );
  assertJson(result.text, catalogOf("A" + ",".repeat(14) + "10"));
  assertJson(result.changed, 1);
});
