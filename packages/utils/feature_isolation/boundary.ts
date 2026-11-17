import { dirname, isAbsolute, join, normalize, relative } from "@std/path";
import type { ImportRef } from "./scan.ts";

/** `name` は deno.json の `name`、`directory` はリポジトリルートからの相対パス */
export type FeaturePackage = { name: string; directory: string };

export type Violation = { file: string; line: number; specifier: string };

function isInside(directory: string, path: string): boolean {
  const from = relative(directory, path);
  return from !== ".." && !from.startsWith("../") && !isAbsolute(from);
}

function isOtherPackageName(
  specifier: string,
  own: FeaturePackage,
  features: FeaturePackage[],
): boolean {
  return features.some((feature) =>
    feature.name !== own.name &&
    (specifier === feature.name || specifier.startsWith(feature.name + "/"))
  );
}

/** 相対パスが、自パッケージのフォルダーの外へ出るなら違反とする */
function escapesPackage(
  file: string,
  specifier: string,
  own: FeaturePackage,
): boolean {
  if (!specifier.startsWith(".")) {
    return false;
  }
  return !isInside(own.directory, normalize(join(dirname(file), specifier)));
}

export function violationsOf(
  file: string,
  refs: ImportRef[],
  own: FeaturePackage,
  features: FeaturePackage[],
): Violation[] {
  return refs
    .filter(({ specifier }) =>
      isOtherPackageName(specifier, own, features) ||
      escapesPackage(file, specifier, own)
    )
    .map(({ line, specifier }) => ({ file, line, specifier }));
}

/** 受け取った deno.json のパスのうち、`<グループ>/<パッケージ>/deno.json` の形でないものを返す。パスは `featuresRoot` からの相対パス */
export function misplacedDenoJsons(relativePaths: string[]): string[] {
  return relativePaths.filter((path) => path.split("/").length !== 3);
}
