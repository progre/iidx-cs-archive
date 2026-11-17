import { assertEquals } from "@std/assert";
import {
  declarationsOf,
  exportedNamesOf,
  hasNamespaceImport,
  namesFrom,
} from "./names.ts";

const CORE = "@csa/core";

Deno.test("namesFrom: 複数行の import と type 修飾を読む", () => {
  const source = [
    "import type {",
    "  A,",
    "  type B,",
    "  C as D,",
    '} from "@csa/core";',
    'import { E } from "@csa/other";',
  ].join("\n");
  assertEquals(namesFrom(source, CORE), ["A", "B", "C"]);
});

Deno.test("namesFrom: 再エクスポートとコメント内の記述", () => {
  const source = [
    'export type { A } from "@csa/core";',
    '// import { Z } from "@csa/core";',
  ].join("\n");
  assertEquals(namesFrom(source, CORE), ["A"]);
});

Deno.test("hasNamespaceImport: import * as を検出する", () => {
  assertEquals(
    hasNamespaceImport('import * as core from "@csa/core";', CORE),
    true,
  );
  assertEquals(
    hasNamespaceImport('import { A } from "@csa/core";', CORE),
    false,
  );
});

Deno.test("exportedNamesOf: 宣言、名前指定、別名、export * を集める", () => {
  const source = [
    'export type { A, B as C } from "./a.ts";',
    'export type * from "./b.ts";',
    "export const D = 1;",
    "export interface E {}",
    "type Hidden = string;",
  ].join("\n");
  assertEquals(exportedNamesOf(source), {
    names: ["A", "C", "D", "E"],
    wildcardSpecifiers: ["./b.ts"],
    reexportSpecifiers: ["./a.ts"],
  });
});

Deno.test("declarationsOf: 次の export までを本体にする", () => {
  const source = [
    "export interface P {",
    "  q: Q;",
    "}",
    "",
    "export type Q = string;",
  ].join("\n");
  const declarations = declarationsOf(source);
  assertEquals(declarations.map(({ name }) => name), ["P", "Q"]);
  assertEquals(declarations[0].body.includes("Q"), true);
  assertEquals(declarations[1].body.includes("P"), false);
});
