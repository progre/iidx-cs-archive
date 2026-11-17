import { assertEquals } from "@std/assert";
import { SEC } from "@csa/core";
import { buildMetadata, buildRelocations, placeElf } from "./placement.ts";

const IMAGE = { elf: { lba: 100, recordOffset: 0x30 } };

Deno.test("ELFは配置計画の末尾に、セクター単位で切り上げて置く", () => {
  assertEquals(placeElf({ totalSectors: 1000 }, SEC * 3 + 1), {
    lba: 1000,
    sectors: 4,
    volumeSectors: 1004,
  });
});

Deno.test("再配置は、原盤の位置から置き直した位置への移動を1件返す", () => {
  const placement = placeElf({ totalSectors: 1000 }, SEC);
  assertEquals(buildRelocations(IMAGE, placement, "SLPM_650.00"), [
    {
      fromLba: 100,
      name: "\\SLPM_650.00;1",
      sectors: 1,
      toLba: 1000,
    },
  ]);
});

Deno.test("ディレクトリレコードは、新しい位置と実際の大きさに書き換える", () => {
  const placement = placeElf({ totalSectors: 1000 }, SEC);
  assertEquals(buildMetadata(IMAGE, placement, 1234), [
    { lba: 1000, recordOffset: 0x30, size: 1234 },
  ]);
});
