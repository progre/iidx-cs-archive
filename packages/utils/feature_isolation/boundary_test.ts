// 実行: deno test packages/utils/feature_isolation/boundary_test.ts
import {
  type FeaturePackage,
  misplacedDenoJsons,
  violationsOf,
} from "./boundary.ts";

function assertEquals(actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`${a} != ${e}`);
  }
}

const ROOT = "packages/features";
const FEATURES: FeaturePackage[] = [
  { name: "@csa/contents-elf", directory: `${ROOT}/contents/elf` },
  { name: "@csa/contents-chart", directory: `${ROOT}/contents/chart` },
  { name: "@csa/layout-iso-plan", directory: `${ROOT}/layout/iso_plan` },
];
const [ELF] = FEATURES;
const FILE = `${ROOT}/contents/elf/code/a.ts`;

function check(...specifiers: string[]) {
  const refs = specifiers.map((specifier, index) => ({
    line: index + 1,
    specifier,
  }));
  return violationsOf(FILE, refs, ELF, FEATURES).map((v) => v.specifier);
}

Deno.test("core や外部パッケージと、自パッケージ内の相対パスは許す", () => {
  assertEquals(
    check("@csa/core", "@std/path", "npm:jimp", "../elf/mod.ts", "./b.ts"),
    [],
  );
});

Deno.test("自パッケージの名前での参照は許す", () => {
  assertEquals(check("@csa/contents-elf"), []);
});

Deno.test("同じグループの別パッケージへの参照を違反とする", () => {
  assertEquals(check("@csa/contents-chart"), ["@csa/contents-chart"]);
});

Deno.test("別グループのパッケージへの参照を違反とする", () => {
  assertEquals(check("@csa/layout-iso-plan"), ["@csa/layout-iso-plan"]);
});

Deno.test("サブパスつきの参照も違反とする", () => {
  assertEquals(check("@csa/contents-chart/fix"), ["@csa/contents-chart/fix"]);
});

Deno.test("名前が前方一致するだけの別パッケージは違反としない", () => {
  assertEquals(check("@csa/contents-chart-extra"), []);
});

Deno.test("パッケージのフォルダーの外へ出る相対パスを違反とする", () => {
  assertEquals(
    check("../../../chart/mod.ts", "../../../../layout/iso_plan/mod.ts"),
    ["../../../chart/mod.ts", "../../../../layout/iso_plan/mod.ts"],
  );
});

Deno.test("違反にはファイルと行を付ける", () => {
  const refs = [{ line: 7, specifier: "@csa/contents-chart" }];
  assertEquals(violationsOf(FILE, refs, ELF, FEATURES), [
    { file: FILE, line: 7, specifier: "@csa/contents-chart" },
  ]);
});

Deno.test("2階層目の deno.json は違反にしない", () => {
  assertEquals(misplacedDenoJsons(["layout/iso_plan/deno.json"]), []);
});

Deno.test("グループの直下にある deno.json は違反にする", () => {
  assertEquals(misplacedDenoJsons(["layout/deno.json"]), ["layout/deno.json"]);
});

Deno.test("3階層目以降にある deno.json は違反にする", () => {
  assertEquals(
    misplacedDenoJsons([
      "layout/iso_plan/deno.json",
      "layout/iso_plan/plan/deno.json",
    ]),
    ["layout/iso_plan/plan/deno.json"],
  );
});

Deno.test("features の直下にある deno.json は違反にする", () => {
  assertEquals(misplacedDenoJsons(["deno.json"]), ["deno.json"]);
});
