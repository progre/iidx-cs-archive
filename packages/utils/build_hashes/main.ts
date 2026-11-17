// 実行: deno run --allow-read=. --allow-write=build/hashes \
//   packages/utils/build_hashes/main.ts <サブコマンド> ...
import { parseArgs } from "@std/cli/parse-args";
import { BUILD_DIRECTORY } from "@csa/core";
import { extentsOfPlan, stringifyRecord } from "./record/mod.ts";
import { extentTable, GROUPS, groupTable, isoTable } from "./table/mod.ts";
import type {
  Difference,
  DigestTable,
  GroupSpec,
  IntermediateRecord,
  IsoRecord,
} from "./types.ts";

/** 記録(expected)と実測(actual)の差分を、パスの昇順で返す */
export function diffTables(
  expected: DigestTable,
  actual: DigestTable,
): Difference[] {
  const paths = [...new Set([...Object.keys(expected), ...Object.keys(actual)])]
    .sort();
  return paths.flatMap((path): Difference[] => {
    const want = expected[path];
    const got = actual[path];
    if (!got) {
      return [{ path, kind: "missing" }];
    }
    if (!want) {
      return [{ path, kind: "added" }];
    }
    const same = want.size === got.size && want.sha256 === got.sha256 &&
      want.lba === got.lba;
    return same ? [] : [{ path, kind: "changed" }];
  });
}

const DEFAULT_DIRECTORY = `${BUILD_DIRECTORY}/hashes`;
const USAGE = `Usage:
  record --iso=<ISO> --plan=<placement plan TSV>
                         Record the hash of each file in the ISO
  check --iso=<ISO>      List files that differ from the record
  record-intermediates   Record the hashes of intermediates
  check-intermediates    List files that differ from the record
Common: --dir=<record directory> (default ${DEFAULT_DIRECTORY})
Intermediates: --root=<group>=<folder> replaces the target folder`;

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await Deno.readTextFile(path)) as T;
}

function report(differences: Difference[]): void {
  differences.forEach(({ kind, path }) => console.log(`${kind}\t${path}`));
  console.log(`${differences.length} differences`);
  if (differences.length > 0) {
    Deno.exit(1);
  }
}

function withPrefix(prefix: string, differences: Difference[]): Difference[] {
  return differences.map((item) => ({ ...item, path: prefix + item.path }));
}

function specsOf(
  record: IntermediateRecord | undefined,
  roots: string[],
): Record<string, GroupSpec> {
  const overrides = Object.fromEntries(roots.map((entry) => {
    const [group, ...rest] = entry.split("=");
    return [group, rest.join("=")];
  }));
  return Object.fromEntries(
    Object.entries(record ?? GROUPS).map(([name, spec]) => [name, {
      root: overrides[name] ?? GROUPS[name]?.root ?? spec.root,
      pattern: spec.pattern,
    }]),
  );
}

async function recordIso(
  file: string,
  isoPath: string,
  planPath: string,
): Promise<void> {
  const extents = extentsOfPlan(await Deno.readTextFile(planPath));
  const record: IsoRecord = {
    files: await isoTable(isoPath),
    extents: await extentTable(isoPath, extents),
  };
  await Deno.writeTextFile(file, stringifyRecord(record));
  console.log(
    `${file}: recorded ${Object.keys(record.files).length} ISO9660 files and ` +
      `${Object.keys(record.extents).length} absolute LBA assets`,
  );
}

async function checkIso(file: string, isoPath: string): Promise<void> {
  const record = await readJson<IsoRecord>(file);
  const extents = Object.entries(record.extents).map(([key, digest]) => ({
    key,
    lba: digest.lba!,
    size: digest.size,
  }));
  report([
    ...diffTables(record.files, await isoTable(isoPath)),
    ...diffTables(record.extents, await extentTable(isoPath, extents)),
  ]);
}

async function recordIntermediates(
  file: string,
  roots: string[],
): Promise<void> {
  const record: IntermediateRecord = {};
  for (const [name, spec] of Object.entries(specsOf(undefined, roots))) {
    record[name] = {
      root: GROUPS[name].root,
      pattern: spec.pattern,
      files: await groupTable(spec),
    };
  }
  await Deno.writeTextFile(file, stringifyRecord(record));
  const count = Object.values(record).reduce(
    (sum, group) => sum + Object.keys(group.files).length,
    0,
  );
  console.log(`${file}: recorded ${count}`);
}

async function checkIntermediates(
  file: string,
  roots: string[],
): Promise<void> {
  const record = await readJson<IntermediateRecord>(file);
  const specs = specsOf(record, roots);
  const differences: Difference[] = [];
  for (const [name, group] of Object.entries(record)) {
    const actual = await groupTable(specs[name]);
    differences.push(
      ...withPrefix(`${name}/`, diffTables(group.files, actual)),
    );
  }
  report(differences);
}

async function main(): Promise<void> {
  const args = parseArgs(Deno.args, {
    string: ["dir", "iso", "plan", "root"],
    collect: ["root"],
  });
  const directory = args.dir ?? DEFAULT_DIRECTORY;
  const isoFile = `${directory}/iso_files.json`;
  const intermediateFile = `${directory}/intermediates.json`;
  const command = args._[0];

  if (command === "record" && args.iso && args.plan) {
    await recordIso(isoFile, args.iso, args.plan);
  } else if (command === "check" && args.iso) {
    await checkIso(isoFile, args.iso);
  } else if (command === "record-intermediates") {
    await recordIntermediates(intermediateFile, args.root);
  } else if (command === "check-intermediates") {
    await checkIntermediates(intermediateFile, args.root);
  } else {
    console.error(USAGE);
    Deno.exit(2);
  }
}

if (import.meta.main) {
  await main();
}
