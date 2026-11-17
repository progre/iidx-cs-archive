import { assertEquals } from "@std/assert";
import { readSheetOverlayFields } from "./entry.ts";
import type { SheetOverlayLayout } from "./layouts.ts";

const LAYOUT: SheetOverlayLayout = {
  kind: "sheet",
  packageCount: 3,
  packagesOffset: 0x10,
  pairCount: 3,
  pairsOffset: 0x20,
};

const ENTRY_AT = 8;

function elfWith(write: (view: DataView) => void): Uint8Array {
  const elf = new Uint8Array(ENTRY_AT + 0x40);
  write(new DataView(elf.buffer, ENTRY_AT));
  return elf;
}

Deno.test("空枠を除いた一覧と、枠の位置を保った組を読む", () => {
  const elf = elfWith((view) => {
    view.setUint16(0x10, 0xffff, true);
    view.setUint16(0x12, 6, true);
    view.setUint16(0x14, 0, true);
    view.setUint16(0x20, 3, true);
    view.setUint16(0x22, 6, true);
    view.setUint16(0x24, 4, true);
    view.setUint16(0x26, 0xffff, true);
    view.setUint16(0x28, 5, true);
    view.setUint16(0x2a, 6, true);
  });
  assertEquals(readSheetOverlayFields(elf, ENTRY_AT, LAYOUT), {
    packages: [6],
    pairs: [{ animation: 3, index: 6 }, null, { animation: 5, index: 6 }],
  });
});
