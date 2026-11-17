// 実行: deno run --allow-read=. packages/utils/feature_isolation/core_usage/main.ts
// `--list` を付けると、名前ごとの使用先を全件出力する。
import { featurePackages } from "../scan.ts";
import { coreExports, coreUsesOf } from "./read.ts";
import { type NameUsage, usageOf, usedByFewerThanTwo } from "./usage.ts";

const FEATURES_ROOT = "packages/features";
const CORE_MOD = "packages/core/lib.ts";

function describe({ name, packages }: NameUsage): string {
  return `${name}: ${packages.length === 0 ? "none" : packages.join(", ")}`;
}

function main(): void {
  const { names, declarations } = coreExports(CORE_MOD);
  const usages = usageOf(
    names,
    coreUsesOf(featurePackages(FEATURES_ROOT)),
    declarations,
  );
  if (Deno.args.includes("--list")) {
    usages.map(describe).forEach((line) => console.log(line));
  }
  const violations = usedByFewerThanTwo(usages);
  violations.forEach((usage) =>
    console.error(
      `core name used by fewer than 2 features: ${describe(usage)}`,
    )
  );
  console.log(
    `checked ${usages.length} names, ${violations.length} violations`,
  );
  if (violations.length > 0) {
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}
