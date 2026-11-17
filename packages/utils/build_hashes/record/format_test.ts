import { stringifyRecord } from "./format.ts";

Deno.test("ハッシュ1件を1行にして整形する", () => {
  const actual = stringifyRecord({
    files: { "A.DAT": { size: 1, sha256: "aa" } },
    extents: {},
  });
  const expected = `{
  "files": {
    "A.DAT": {"size":1,"sha256":"aa"}
  },
  "extents": {}
}
`;
  if (actual !== expected) {
    throw new Error(actual);
  }
});
