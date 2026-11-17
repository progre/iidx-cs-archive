import { diffTables } from "./main.ts";
import type { DigestTable } from "./types.ts";

function assertEquals(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${JSON.stringify(actual)} != ${JSON.stringify(expected)}`,
    );
  }
}

const table: DigestTable = {
  "A.DAT": { size: 10, sha256: "aa" },
  "B.DAT": { size: 20, sha256: "bb" },
};

Deno.test("同じ表は差分0件", () => {
  assertEquals(diffTables(table, structuredClone(table)), []);
});

Deno.test("LBA の違いも差分にする", () => {
  const expected: DigestTable = { "abc/1": { size: 1, sha256: "a", lba: 10 } };
  const actual: DigestTable = { "abc/1": { size: 1, sha256: "a", lba: 11 } };
  assertEquals(diffTables(expected, actual), [
    { path: "abc/1", kind: "changed" },
  ]);
});

Deno.test("ハッシュ違い・大きさ違い・欠落・追加をパス順に検出する", () => {
  const actual: DigestTable = {
    "A.DAT": { size: 10, sha256: "xx" },
    "B.DAT": { size: 21, sha256: "bb" },
    "C.DAT": { size: 1, sha256: "cc" },
  };
  const expected: DigestTable = {
    ...table,
    "0.DAT": { size: 5, sha256: "00" },
  };
  assertEquals(diffTables(expected, actual), [
    { path: "0.DAT", kind: "missing" },
    { path: "A.DAT", kind: "changed" },
    { path: "B.DAT", kind: "changed" },
    { path: "C.DAT", kind: "added" },
  ]);
});
