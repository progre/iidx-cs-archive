import { assertEquals } from "@std/assert";
import { usageOf, usedByFewerThanTwo } from "./usage.ts";

const uses = [
  { packageName: "@csa/x", names: ["Shared", "Outer", "OnlyX"] },
  { packageName: "@csa/y", names: ["Shared", "Outer"] },
];

Deno.test("usageOf: 名前ごとに使うパッケージを集める", () => {
  const usages = usageOf(["Shared", "OnlyX", "Unused"], uses, []);
  assertEquals(usages, [
    { name: "OnlyX", packages: ["@csa/x"] },
    { name: "Shared", packages: ["@csa/x", "@csa/y"] },
    { name: "Unused", packages: [] },
  ]);
});

Deno.test("usageOf: 別の型の定義に現れる名前は、その型を使うパッケージも使うとみなす", () => {
  const usages = usageOf(
    ["Outer", "Inner", "Deep"],
    uses,
    [
      { name: "Outer", body: " { inner: Inner }" },
      { name: "Inner", body: " { deep: Deep }" },
      { name: "Deep", body: " = string" },
    ],
  );
  assertEquals(usages.map(({ packages }) => packages.length), [2, 2, 2]);
});

Deno.test("usedByFewerThanTwo: 2パッケージ未満の名前だけを返す", () => {
  const found = usedByFewerThanTwo([
    { name: "A", packages: [] },
    { name: "B", packages: ["@csa/x"] },
    { name: "C", packages: ["@csa/x", "@csa/y"] },
  ]);
  assertEquals(found.map(({ name }) => name), ["A", "B"]);
});
