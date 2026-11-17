import { withoutComments } from "../scan.ts";

/** `wildcardSpecifiers` は `export *` の参照先、`reexportSpecifiers` は名前を指定した再エクスポートの参照先 */
export type ExportedNames = {
  names: string[];
  wildcardSpecifiers: string[];
  reexportSpecifiers: string[];
};

const NAME_LIST = /\b(?:import|export)\s+(?:type\s+)?\{([^}]*)\}/g;
const EXPORT_LIST = /\bexport\s+(?:type\s+)?\{([^}]*)\}/g;
const REEXPORT =
  /\bexport\s+(?:type\s+)?\{[^}]*\}\s*from\s*(["'])([^"'\n]+)\1/g;
const WILDCARD = /\bexport\s+(?:type\s+)?\*\s+from\s*(["'])([^"'\n]+)\1/g;
const DECLARATION =
  /^export\s+(?:declare\s+)?(?:abstract\s+)?(?:type|interface|const|function|class|enum)\s+(\w+)/gm;

/** 波括弧の中の1項目から、`as` の前後のうち指定した側の名前を返す */
function nameOf(item: string, side: "original" | "alias"): string {
  const words = item.trim().replace(/^type\s+/, "").split(/\s+as\s+/);
  return side === "original" ? words[0] : words[words.length - 1];
}

function namesIn(
  code: string,
  pattern: RegExp,
  side: "original" | "alias",
): string[] {
  return [...code.matchAll(pattern)]
    .flatMap((match) => match[1].split(","))
    .filter((item) => item.trim() !== "")
    .map((item) => nameOf(item, side));
}

function escaped(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
}

/** 指定子 `specifier` から import または再エクスポートしている名前を返す */
export function namesFrom(source: string, specifier: string): string[] {
  const code = withoutComments(source);
  const fromSpecifier = new RegExp(
    NAME_LIST.source + "\\s*from\\s*([\"'])" + escaped(specifier) + "\\2",
    "g",
  );
  return namesIn(code, fromSpecifier, "original");
}

/** 指定子 `specifier` に対する `import * as` を含むかどうか */
export function hasNamespaceImport(source: string, specifier: string): boolean {
  const code = withoutComments(source);
  return new RegExp(
    "\\bimport\\s+(?:type\\s+)?\\*\\s+as\\s+\\w+\\s+from\\s*[\"']" +
      escaped(specifier) + "[\"']",
  ).test(code);
}

export type Declaration = { name: string; body: string };

const DECLARATION_HEAD = new RegExp(DECLARATION.source + "([\\s\\S]*)");

/** 行頭の `export` から次の行頭の `export` までを、1つの宣言として切り出す */
export function declarationsOf(source: string): Declaration[] {
  return withoutComments(source)
    .split(/^(?=export\s)/m)
    .flatMap((chunk) => {
      const match = DECLARATION_HEAD.exec(chunk);
      return match === null ? [] : [{ name: match[1], body: match[2] }];
    });
}

/** モジュールが外へ出す名前と、`export *` の参照先を返す */
export function exportedNamesOf(source: string): ExportedNames {
  const code = withoutComments(source);
  return {
    names: [
      ...namesIn(code, EXPORT_LIST, "alias"),
      ...[...code.matchAll(DECLARATION)].map((match) => match[1]),
    ],
    wildcardSpecifiers: [...code.matchAll(WILDCARD)].map((match) => match[2]),
    reexportSpecifiers: [...code.matchAll(REEXPORT)].map((match) => match[2]),
  };
}
