import type { Declaration } from "./names.ts";

export type PackageUse = { packageName: string; names: string[] };

export type NameUsage = { name: string; packages: string[] };

function mentions(declaration: Declaration, name: string): boolean {
  return new RegExp("\\b" + name + "\\b").test(declaration.body);
}

function mergedPackages(
  name: string,
  current: Map<string, Set<string>>,
  declarations: Declaration[],
): Set<string> {
  const merged = new Set(current.get(name));
  declarations
    .filter((declaration) =>
      declaration.name !== name && mentions(declaration, name)
    )
    .forEach((declaration) =>
      current.get(declaration.name)?.forEach((pkg) => merged.add(pkg))
    );
  return merged;
}

function propagate(
  current: Map<string, Set<string>>,
  declarations: Declaration[],
): Map<string, Set<string>> {
  const next = new Map(
    [...current.keys()].map((
      name,
    ) => [name, mergedPackages(name, current, declarations)]),
  );
  const unchanged = [...current].every(([name, packages]) =>
    packages.size === next.get(name)?.size
  );
  return unchanged ? next : propagate(next, declarations);
}

/**
 * `core` が外へ出す名前ごとに、その名前を使う features のパッケージを集める。
 * 別の `core` の型の定義に現れる名前は、その型を使うパッケージも使うものとして数える。
 */
export function usageOf(
  exported: string[],
  uses: PackageUse[],
  declarations: Declaration[],
): NameUsage[] {
  const direct = new Map(
    [...new Set(exported)].map((name) => [
      name,
      new Set(
        uses
          .filter((use) => use.names.includes(name))
          .map((use) => use.packageName),
      ),
    ]),
  );
  const propagated = propagate(direct, declarations);
  return [...propagated.keys()].sort().map((name) => ({
    name,
    packages: [...(propagated.get(name) ?? [])].sort(),
  }));
}

/** 使う features のパッケージが2つ未満の名前を返す */
export function usedByFewerThanTwo(usages: NameUsage[]): NameUsage[] {
  return usages.filter(({ packages }) => packages.length < 2);
}
