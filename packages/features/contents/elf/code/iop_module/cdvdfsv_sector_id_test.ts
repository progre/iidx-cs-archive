import { assertEquals, assertThrows } from "@std/assert";
import { CDVDFSV_SECTOR_ID } from "./read_patches.ts";
import { iopPatchRange } from "./source_patch.ts";

const hex = (words: readonly number[]) =>
  words.map((word) => word.toString(16).padStart(8, "0")).join(" ");

Deno.test("cdvdfsvのセクタID照合を下位24bit比較へ組み替え、最後の語は原盤の語を残す", () => {
  const original = [1, 2, 3, 4, 5, 6].map((n) => n * 0x11111111);
  // lw t0,0x24(sp) / subu v0,s0,s4 / sll v0,v0,8 / or v0,v0,t0 / beq v0,zero,+17 / 原盤
  assertEquals(
    hex(CDVDFSV_SECTOR_ID.replace(original)),
    "8fa80024 02141023 00021200 00481025 10400011 66666666",
  );
});

Deno.test("IMGが照合位置より小さければ止める", () => {
  assertThrows(() =>
    iopPatchRange(CDVDFSV_SECTOR_ID, { lba: 0, size: 0x34000 })
  );
});
