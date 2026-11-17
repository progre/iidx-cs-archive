import { dirname, join, normalize } from "@std/path";
import type { FeaturePackage } from "../boundary.ts";
import { sourceFilesOf } from "../scan.ts";
import {
  type Declaration,
  declarationsOf,
  exportedNamesOf,
  hasNamespaceImport,
  namesFrom,
} from "./names.ts";
import type { PackageUse } from "./usage.ts";

export const CORE_SPECIFIER = "@csa/core";

export type CoreExports = { names: string[]; declarations: Declaration[] };

/** `core` の lib.ts から `export *` をたどって、外へ出す名前と宣言を集める */
export function coreExports(modPath: string): CoreExports {
  const source = Deno.readTextFileSync(modPath);
  const { names, wildcardSpecifiers, reexportSpecifiers } = exportedNamesOf(
    source,
  );
  const exportsOf = (specifier: string) =>
    coreExports(normalize(join(dirname(modPath), specifier)));
  const wildcards = wildcardSpecifiers.map(exportsOf);
  const reexports = reexportSpecifiers.map(exportsOf);
  return {
    names: [...names, ...wildcards.flatMap((exports) => exports.names)],
    declarations: [
      ...declarationsOf(source),
      ...[...wildcards, ...reexports].flatMap((exports) =>
        exports.declarations
      ),
    ],
  };
}

function coreNamesOfFile(file: string): string[] {
  const source = Deno.readTextFileSync(file);
  if (hasNamespaceImport(source, CORE_SPECIFIER)) {
    throw new Error(`${file}: ${CORE_SPECIFIER} の import * は検査できない`);
  }
  return namesFrom(source, CORE_SPECIFIER);
}

/** features のパッケージごとに、`core` から import している名前を集める */
export function coreUsesOf(features: FeaturePackage[]): PackageUse[] {
  return features.map(({ name, directory }) => ({
    packageName: name,
    names: sourceFilesOf(directory).flatMap(coreNamesOfFile),
  }));
}
