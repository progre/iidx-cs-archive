import { assertEquals } from "@std/assert";
import { bothEndian, metadataWrites, volumeSectorsOf } from "./metadata.ts";

Deno.test("値はリトルエンディアンとビッグエンディアンを続けて持つ", () => {
  assertEquals([...bothEndian(0x01020304)], [4, 3, 2, 1, 1, 2, 3, 4]);
});

Deno.test("レコードごとにextentとsize、最後にボリューム長を書く", () => {
  const writes = metadataWrites([{ lba: 5, recordOffset: 100, size: 7 }], 9);
  assertEquals(writes.map((write) => write.offset), [102, 110, 16 * 2048 + 80]);
  assertEquals([...writes[0].bytes], [...bothEndian(5)]);
  assertEquals([...writes[1].bytes], [...bothEndian(7)]);
  assertEquals([...writes[2].bytes], [...bothEndian(9)]);
});

Deno.test("PVDからボリューム長を読む", () => {
  const pvd = new Uint8Array(2048);
  pvd.set(bothEndian(1234), 80);
  assertEquals(volumeSectorsOf(pvd), 1234);
});
