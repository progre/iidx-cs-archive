import type { FeaturePackage } from "./boundary.ts";

export type ImportRef = { line: number; specifier: string };

const COMMENTS = /\/\*[\s\S]*?\*\/|\/\/[^\n]*/g;
const SPECIFIER = /\b(?:from|import)\s*\(?\s*(["'])([^"'\n]+)\1/g;

/** 行数を保つため、コメントは同じ数の改行だけを残して消す */
export function withoutComments(source: string): string {
  return source.replace(COMMENTS, (comment) => comment.replace(/[^\n]/g, ""));
}

/** 静的 import、`export ... from`、文字列リテラルの動的 import の指定子を返す */
export function importRefsOf(source: string): ImportRef[] {
  const code = withoutComments(source);
  return [...code.matchAll(SPECIFIER)].map((match) => ({
    line: code.slice(0, match.index ?? 0).split("\n").length,
    specifier: match[2],
  }));
}

const SOURCE = /\.(ts|tsx|js|mjs)$/;

function subdirectories(directory: string): string[] {
  return [...Deno.readDirSync(directory)]
    .filter((entry) => entry.isDirectory && entry.name !== "node_modules")
    .map((entry) => `${directory}/${entry.name}`);
}

/** `features/<グループ>/<パッケージ>/deno.json` から、パッケージ名とフォルダーを集める */
export function featurePackages(featuresRoot: string): FeaturePackage[] {
  return subdirectories(featuresRoot)
    .flatMap(subdirectories)
    .map((directory) => ({
      name: JSON.parse(Deno.readTextFileSync(`${directory}/deno.json`)).name,
      directory,
    }));
}

export function sourceFilesOf(
  directory: string,
  pattern: RegExp = SOURCE,
): string[] {
  const entries = [...Deno.readDirSync(directory)];
  return entries.flatMap((entry) => {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory) {
      return entry.name === "node_modules" ? [] : sourceFilesOf(path, pattern);
    }
    return pattern.test(entry.name) ? [path] : [];
  });
}

/** `featuresRoot` の下にある deno.json を、`featuresRoot` からの相対パスで集める */
export function denoJsonPathsOf(featuresRoot: string): string[] {
  return sourceFilesOf(featuresRoot, /^deno\.json$/).map((path) =>
    path.slice(featuresRoot.length + 1)
  );
}
