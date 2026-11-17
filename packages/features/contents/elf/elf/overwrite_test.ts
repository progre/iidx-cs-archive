import { NOP } from "../code/mips/mod.ts";
import { overwriteCode } from "./overwrite.ts";
import { buildFakeElf } from "./testing.ts";

function assertEquals<T>(actual: T, expected: T, label: string): void {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${label}: ${a} != ${b}`);
}

function assertThrows(fn: () => unknown, label: string): void {
  let threw = false;
  try {
    fn();
  } catch {
    threw = true;
  }
  if (!threw) throw new Error(`${label}: 例外が出なかった`);
}

const BASE = 0x1000;

function filledElf() {
  const elf = buildFakeElf([{ vaddr: BASE, size: 0x10 }]);
  [0, 1, 2, 3].forEach((index) => elf.setU32(BASE + index * 4, 0xaa));
  return elf;
}

const wordsOf = (elf: ReturnType<typeof filledElf>) =>
  [0, 1, 2, 3].map((index) => elf.u32(BASE + index * 4));

Deno.test("overwriteCode: 語を書き、足りない分をNOPで埋める", () => {
  const elf = filledElf();
  overwriteCode(elf, BASE, [0x11], 3);
  assertEquals(wordsOf(elf), [0x11, NOP, NOP, 0xaa], "語");
});

Deno.test("overwriteCode: 長さを省くと語の数だけ書く", () => {
  const elf = filledElf();
  overwriteCode(elf, BASE + 4, [0x22]);
  assertEquals(wordsOf(elf), [0xaa, 0x22, 0xaa, 0xaa], "語");
});

Deno.test("overwriteCode: 語が長さを超えると例外", () => {
  assertThrows(() => overwriteCode(filledElf(), BASE, [1, 2], 1), "超過");
});
