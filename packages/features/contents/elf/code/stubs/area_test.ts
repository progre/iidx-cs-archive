import { checkSlots, type StubSlot } from "../../data/stub_area/mod.ts";
import { packSlot, slotCursor, writeSlot } from "./area.ts";
import { buildFakeElf } from "../../elf/mod.ts";

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
const slot = (name: string, offset: number, bytes: number): StubSlot => ({
  name,
  vaddr: BASE + offset,
  bytes,
});

Deno.test("checkSlots: 昇順で重ならず確保に収まれば通す", () => {
  checkSlots([slot("a", 0, 0x10), slot("b", 0x10, 0x8)], BASE, 0x20);
});

Deno.test("checkSlots: 前の置き場と重なると例外", () => {
  assertThrows(
    () => checkSlots([slot("a", 0, 0x10), slot("b", 0xc, 0x4)], BASE, 0x20),
    "重なり",
  );
});

Deno.test("checkSlots: 昇順でないと例外", () => {
  assertThrows(
    () => checkSlots([slot("a", 0x10, 0x4), slot("b", 0, 0x4)], BASE, 0x20),
    "昇順",
  );
});

Deno.test("checkSlots: 確保の終端を超えると例外", () => {
  assertThrows(() => checkSlots([slot("a", 0x18, 0x10)], BASE, 0x20), "終端");
});

const fakeElf = () => buildFakeElf([{ vaddr: BASE, size: 0x20 }]);

Deno.test("writeSlot: 先頭から語を書く", () => {
  const elf = fakeElf();
  writeSlot(elf, slot("a", 0x4, 0x8), [0x11, 0x22]);
  assertEquals([elf.u32(BASE + 4), elf.u32(BASE + 8)], [0x11, 0x22], "語");
});

Deno.test("writeSlot: 容量を超えると例外", () => {
  assertThrows(
    () => writeSlot(fakeElf(), slot("a", 0, 0x4), [1, 2]),
    "容量超過",
  );
});

Deno.test("writeSlot: 置き場が空でないと例外", () => {
  const elf = fakeElf();
  elf.setU32(BASE + 4, 1);
  assertThrows(() => writeSlot(elf, slot("a", 0, 0x8), [1, 2]), "空でない");
});

Deno.test("packSlot: 並びを詰めた先頭を返し、容量を超えると例外", () => {
  const target = slot("a", 0, 0x10);
  assertEquals(packSlot(target, [[1], [2, 3]]), [BASE, BASE + 4], "先頭");
  assertThrows(() => packSlot(target, [[1, 2, 3], [4, 5]]), "容量超過");
});

Deno.test("slotCursor: 書くたびに後ろへ詰め、容量を超えると例外", () => {
  const place = slotCursor(fakeElf(), slot("a", 0, 0xc));
  assertEquals([place([1, 2]), place([3])], [BASE, BASE + 8], "先頭");
  assertThrows(() => place([4]), "容量超過");
});
