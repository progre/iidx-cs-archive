import { assertEquals, assertThrows } from "@std/assert";
import { CDVDMAN_SECTOR_ID } from "./read_patches.ts";
import { iopPatchRange, sourcePatchOf } from "./source_patch.ts";

const hex = (words: readonly number[]) =>
  words.map((word) => word.toString(16).padStart(8, "0")).join(" ");

Deno.test("cdvdmanのセクタID照合を下位24bit比較へ組み替え、3語目と4語目は原盤の語を残す", () => {
  const original = [1, 2, 3, 4, 5, 6, 7].map((n) => n * 0x11111111);
  // subu v1,s1,a1 / sll v1,v1,8 / 原盤 / 原盤 / beq v1,zero,+8 / addu a2,s1,zero / blez v0,+12
  assertEquals(
    hex(CDVDMAN_SECTOR_ID.replace(original)),
    "02251823 00031a00 33333333 44444444 10600008 02203021 1840000c",
  );
});

Deno.test("差し替え範囲は、IMGのLBAとIMG内の位置から決まる", () => {
  assertEquals(
    iopPatchRange(CDVDMAN_SECTOR_ID, { lba: 0x11e, size: 278353 }),
    { offset: 0x11e * 2048 + 0x26168, length: 28 },
  );
});

Deno.test("IMGが照合位置より小さければ止める", () => {
  assertThrows(() =>
    iopPatchRange(CDVDMAN_SECTOR_ID, { lba: 0, size: 0x26000 })
  );
});

Deno.test("原盤の語列のハッシュが違えば止める", () => {
  assertThrows(() =>
    sourcePatchOf(
      CDVDMAN_SECTOR_ID,
      { lba: 0x11e, size: 278353 },
      new Uint8Array(28),
    )
  );
});
