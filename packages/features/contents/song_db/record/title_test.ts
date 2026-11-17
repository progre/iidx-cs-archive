import { assertEquals } from "@std/assert";
import { PB_DEFINITION, PB_FORMAT } from "../pb/mod.ts";

const TITLE_OFFSET = PB_DEFINITION.songDbRecordLayout.title.offset;

const bytesOf = (title: string): number[] => {
  const record = PB_FORMAT.recordOf(new Uint8Array(PB_FORMAT.size));
  record.title.text = title;
  return Array.from(record.title.bytes);
};

Deno.test("bytesは題名のNULの手前までを返し、末尾の空白を落とさない", () => {
  assertEquals(bytesOf("AB "), Array.from(new TextEncoder().encode("AB ")));
  assertEquals(bytesOf(""), []);
});

Deno.test("bytesはNULが無い最大長の題名も読む", () => {
  const entry = new Uint8Array(PB_FORMAT.size);
  entry.fill(0x41, TITLE_OFFSET, TITLE_OFFSET + 0x40);
  assertEquals(PB_FORMAT.recordOf(entry).title.bytes.length, 0x40);
});
