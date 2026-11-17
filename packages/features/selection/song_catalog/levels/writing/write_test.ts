// 全曲リストへの難易度の書き込み。実データを使わず、組み立てた文字列で確かめる。
// 実行: deno test packages/features/selection/song_catalog/levels/write_test.ts

import { CATALOG_HEADER } from "../../file/mod.ts";
import { applyLevels, catalogKeys } from "./write.ts";

function assertJson(actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`${a} != ${e}`);
  }
}

const catalogOf = (...rows: string[]) =>
  [CATALOG_HEADER, ...rows].join("\n") + "\n";

Deno.test("書く譜面の列だけを変え、ほかの列は変えない", () => {
  const before = catalogOf(
    "A\t\t\tG\tF\tS\tR\t\t\t\t6th" + "\t".repeat(10),
    "B" + "\t".repeat(20),
  );
  const result = applyLevels(
    before,
    new Map([["A", { sn: 4, dh: 10 }]]),
  );
  assertJson(
    result.text,
    catalogOf(
      "A\t\t\tG\tF\tS\tR\t\t\t\t6th\t\t4\t\t\t\t\t\t10\t\t",
      "B" + "\t".repeat(20),
    ),
  );
  assertJson(result.changed, 2);
});

Deno.test("行末で省いた列は、書く分だけ空で補う", () => {
  const result = applyLevels(
    catalogOf("A\t\t\t\tSong"),
    new Map([["A", { sn: 4 }]]),
  );
  assertJson(result.text, catalogOf("A\t\t\t\tSong" + "\t".repeat(8) + "4"));
});

Deno.test("同じ値を書いても変更に数えない", () => {
  const before = catalogOf("A" + "\t".repeat(12) + "4");
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
    catalogOf("A:12" + "\t".repeat(11) + "3", " :87" + "\t".repeat(11) + "5"),
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
    catalogOf("A" + "\t".repeat(12) + "4\t10"),
    new Map([["A", { sn: null }]]),
  );
  assertJson(result.text, catalogOf("A" + "\t".repeat(13) + "10"));
  assertJson(result.changed, 1);
});
