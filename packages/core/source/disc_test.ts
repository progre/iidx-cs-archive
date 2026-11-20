import { assertEquals } from "@std/assert";
import { discOffsetOf, inDiscOrder, inKeyOrder, SEC } from "./disc.ts";

Deno.test("アーカイブの中の位置で並べ、無いアーカイブは最後に回す", () => {
  const files = new Map([["A.DAT", { lba: 2 }], ["B.DAT", { lba: 1 }]]);
  const items = [
    { archive: "c.dat;1", offset: 0 },
    { archive: "a.dat;1", offset: 5 },
    { archive: "b.dat;1", offset: 5 },
  ];
  const sorted = inDiscOrder(
    items,
    (item) => discOffsetOf(files, item.archive, item.offset),
  );
  assertEquals(sorted.map((item) => item.archive), [
    "b.dat;1",
    "a.dat;1",
    "c.dat;1",
  ]);
  assertEquals(discOffsetOf(files, "a.dat;1", 5), 2 * SEC + 5);
});

Deno.test("読んだ順の表を、元の並びに戻し、並びに無いキーは後ろに残す", () => {
  const read = new Map([["b", 2], ["x", 9], ["a", 1]]);
  assertEquals([...inKeyOrder(read, ["a", "b", "a"])], [
    ["a", 1],
    ["b", 2],
    ["x", 9],
  ]);
});
