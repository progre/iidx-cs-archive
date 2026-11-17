import { assertEquals, assertThrows } from "@std/assert";
import { parseOld } from "./old_bank.ts";
import { oldBank, SOUND_BYTES } from "./testing.ts";

Deno.test("旧バンクの音を entry_id 順に読む", () => {
  const bank = parseOld(oldBank([2, 10]));
  assertEquals(bank.entries.map((e) => e.entryId), [5, 6]);
  assertEquals(bank.entries.map((e) => e.volumeGroup), [0, 1]);
  assertEquals(bank.entries.map((e) => e.entryType), [2, 10]);
});

Deno.test("終端フレームまで数えて1チャンネルの長さを決める", () => {
  const [entry] = parseOld(oldBank([2])).entries;
  assertEquals(entry.size, SOUND_BYTES);
  assertEquals(entry.ch, 1);
  assertEquals(entry.rate1, 44100);
});

Deno.test("先頭u32がファイル長と違えば旧形式として読まない", () => {
  const buf = oldBank([2]);
  new DataView(buf.buffer).setUint32(0, 1, true);
  assertThrows(() => parseOld(buf), Error, "旧形式ではない");
});
