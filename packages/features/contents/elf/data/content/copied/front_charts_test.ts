// `front_charts`の欄の写し。PBと同じ欄の位置を持つ偽のエントリーの形で確かめる。

import { assertEquals, assertThrows } from "@std/assert";
import { buildFakeElf } from "../../../elf/mod.ts";
import type { SongContent } from "../../../model/mod.ts";
import type { CsaSongDb, EntryFormat } from "../song_db.ts";
import { verifyFrontCharts, writeFrontCharts } from "./front_charts.ts";

const SLOTS = [
  "sp_hyper",
  "dp_hyper",
  "sp_another",
  "dp_another",
  "sp_normal",
  "dp_normal",
  "sp_beginner",
  "dp_beginner",
  "sp_black",
  "dp_black",
];
const RANKS = ["normal", "hyper", "another", "beginner", "black"];
const SIZE = 0x134;
const SOUNDS = 0xe8;
const NOTES = 0x108;

const slotOf = (name: string) => SLOTS.indexOf(name);
const rankOf = (name: string) => RANKS.indexOf(name.split("_")[1]);
const keysound = (name: string) =>
  SOUNDS + ((slotOf(name) >> 1) * 4 + (slotOf(name) & 1)) * 2;

const format = {
  bgmFieldOffset: (name: string) => keysound(name) + 4,
  chartFieldOffset: (name: string) => 0xc0 + slotOf(name) * 4,
  definition: {
    songDbRecordLayout: { chart: { sounds: { count: 16, offset: SOUNDS } } },
    songDbRecordLength: SIZE,
  },
  keysoundFieldOffset: keysound,
  levelFieldOffset: (name: string) =>
    0x4a + (name.startsWith("dp") ? 5 : 0) + rankOf(name),
  notesFieldOffsets: (name: string) => [NOTES + rankOf(name) * 2],
} as unknown as EntryFormat;

const songDb: CsaSongDb = { format, vaddr: 0x1000 };
const FRONT = 0;
const BACK = 1;
const at = (index: number, offset: number) => 0x1000 + index * SIZE + offset;

/** 裏の曲は SP ANOTHER を持ち、SP NORMAL のノーツ数は 77 */
function elfWithBack() {
  const elf = buildFakeElf([{ size: SIZE * 2, vaddr: 0x1000 }]);
  elf.setBytes(
    at(BACK, format.levelFieldOffset("sp_another")),
    Uint8Array.of(5),
  );
  elf.setU16(at(BACK, NOTES + 2 * 2), 300);
  elf.setU32(at(BACK, format.chartFieldOffset("sp_another")), 0x11);
  elf.setU16(at(BACK, keysound("sp_another")), 0x22);
  elf.setU16(at(BACK, NOTES), 77);
  return elf;
}

const content = (frontCharts: Record<string, string>) =>
  ({
    songs: [{
      targetSongIndex: BACK,
      variantOf: { frontCharts, rule: "custom", targetSongIndex: FRONT },
    }],
  }) as unknown as SongContent;

Deno.test("裏の曲の SP ANOTHER を、表の曲の黒ANOTHER へ写す", () => {
  const elf = elfWithBack();
  const sl = content({ sp_black: "sp_another" });
  writeFrontCharts(elf, songDb, sl);
  verifyFrontCharts(elf, songDb, sl);
  assertEquals(
    elf.slice(at(FRONT, format.levelFieldOffset("sp_black")), 1),
    Uint8Array.of(5),
  );
  assertEquals(elf.u16(at(FRONT, NOTES + 4 * 2)), 300);
  assertEquals(elf.u32(at(FRONT, format.chartFieldOffset("sp_black"))), 0x11);
  // 黒ANOTHERのキー音の位置はノーツ数の欄に重なるので、写さない
  assertEquals(elf.u16(at(BACK, NOTES)), 77);
  assertEquals(elf.u16(at(FRONT, NOTES)), 0);
});

const moved = (movedCharts: Record<string, string>) =>
  ({
    songs: [{
      targetSongIndex: BACK,
      variantOf: { movedCharts, rule: "custom", targetSongIndex: FRONT },
    }],
  }) as unknown as SongContent;

Deno.test("表の曲が持つ難易度の組では、裏の曲の中で譜面を移し、移した元を空にする", () => {
  const elf = elfWithBack();
  const sh = moved({ sp_hyper: "sp_another" });
  writeFrontCharts(elf, songDb, sh);
  verifyFrontCharts(elf, songDb, sh);
  const levelOf = (index: number, name: string) =>
    elf.slice(at(index, format.levelFieldOffset(name)), 1)[0];
  assertEquals(levelOf(BACK, "sp_hyper"), 5);
  assertEquals(elf.u16(at(BACK, NOTES + 1 * 2)), 300);
  assertEquals(elf.u32(at(BACK, format.chartFieldOffset("sp_hyper"))), 0x11);
  // 移した元はレベルとノーツ数だけを0にする。譜面と音の欄は資産を指すので残す
  assertEquals(levelOf(BACK, "sp_another"), 0);
  assertEquals(elf.u16(at(BACK, NOTES + 2 * 2)), 0);
  assertEquals(elf.u32(at(BACK, format.chartFieldOffset("sp_another"))), 0x11);
  // 表の曲へは写さない
  assertEquals(levelOf(FRONT, "sp_hyper"), 0);
});

Deno.test("移した元がほかの組の移し先なら、空にしない", () => {
  const elf = elfWithBack();
  elf.setBytes(
    at(BACK, format.levelFieldOffset("sp_normal")),
    Uint8Array.of(2),
  );
  writeFrontCharts(
    elf,
    songDb,
    moved({ sp_another: "sp_normal", sp_hyper: "sp_another" }),
  );
  assertEquals(
    elf.slice(at(BACK, format.levelFieldOffset("sp_another")), 1)[0],
    2,
  );
});

Deno.test("裏の曲が写し元の難易度を持たなければ止める", () => {
  assertThrows(
    () =>
      writeFrontCharts(
        elfWithBack(),
        songDb,
        content({ sp_black: "sp_hyper" }),
      ),
    Error,
    "裏の曲1はsp_hyperを持たない",
  );
});
