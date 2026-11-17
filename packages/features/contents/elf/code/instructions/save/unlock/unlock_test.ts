import { unlockListHalves } from "./list.ts";
import { LIST_CAPACITY } from "./mod.ts";

const END = 0xffff;

function assertEquals<T>(actual: T, expected: T): void {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${a} != ${b}`);
}

Deno.test("表A・表Bとも全曲を並べ、-1で終える", () => {
  assertEquals(unlockListHalves(3), {
    halves: Array.of(0, 1, 2, END, 0, 1, 2, END),
    starts: Array.of(0, 4),
  });
});

Deno.test("表Bの先頭を4バイト境界に揃える", () => {
  assertEquals(unlockListHalves(2), {
    halves: Array.of(0, 1, END, 0, 0, 1, END),
    starts: Array.of(0, 4),
  });
});

Deno.test("確保容量に収まるのは1919曲まで", () => {
  const bytesOf = (songs: number) => unlockListHalves(songs).halves.length * 2;
  assertEquals(bytesOf(1919) <= LIST_CAPACITY, true);
  assertEquals(bytesOf(1920) <= LIST_CAPACITY, false);
});
