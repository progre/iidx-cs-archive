// 実行: deno test packages/utils/feature_isolation/imports_test.ts
import { importRefsOf } from "./scan.ts";

function assertEquals(actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`${a} != ${e}`);
  }
}

Deno.test("静的 import・export from・動的 import を行番号つきで拾う", () => {
  const source = [
    'import { a } from "@csa/core";',
    "import type {",
    "  B,",
    '} from "./b.ts";',
    'export * from "../c.ts";',
    'const d = await import("./d.ts");',
    'import "./e.ts";',
  ].join("\n");
  assertEquals(importRefsOf(source), [
    { line: 1, specifier: "@csa/core" },
    { line: 4, specifier: "./b.ts" },
    { line: 5, specifier: "../c.ts" },
    { line: 6, specifier: "./d.ts" },
    { line: 7, specifier: "./e.ts" },
  ]);
});

Deno.test("コメント内の記述は拾わず、行番号はずらさない", () => {
  const source = [
    '// import { a } from "@csa/contents-elf";',
    "/* 複数行の",
    '   import x from "@csa/contents-chart"; */',
    'import { b } from "./b.ts";',
  ].join("\n");
  assertEquals(importRefsOf(source), [{ line: 4, specifier: "./b.ts" }]);
});
