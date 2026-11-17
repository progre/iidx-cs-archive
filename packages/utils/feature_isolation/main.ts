// 実行: deno run --allow-read=. packages/utils/feature_isolation/main.ts
import { misplacedDenoJsons, violationsOf } from "./boundary.ts";
import { importRefsOf } from "./scan.ts";
import { denoJsonPathsOf, featurePackages, sourceFilesOf } from "./scan.ts";

const FEATURES_ROOT = "packages/features";

function main(): void {
  const features = featurePackages(FEATURES_ROOT);
  const violations = features.flatMap((own) =>
    sourceFilesOf(own.directory).flatMap((file) =>
      violationsOf(
        file,
        importRefsOf(Deno.readTextFileSync(file)),
        own,
        features,
      )
    )
  );
  violations.forEach(({ file, line, specifier }) =>
    console.error(`${file}:${line} refers to another feature: ${specifier}`)
  );
  const misplaced = misplacedDenoJsons(denoJsonPathsOf(FEATURES_ROOT));
  misplaced.forEach((path) =>
    console.error(
      `${FEATURES_ROOT}/${path} deno.json outside features/<group>/<package>/`,
    )
  );
  const count = violations.length + misplaced.length;
  console.log(`checked ${features.length} packages, ${count} violations`);
  if (count > 0) {
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}
