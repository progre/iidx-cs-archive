// 曲DBエントリの合成が集める参照欄を、組み立てた値で確かめる。原盤は読まない。
import { assertEquals } from "@std/assert";
import { PB_DEFINITION, PB_FORMAT } from "../pb/mod.ts";
import { synthesizeEntry } from "./synthesize.ts";
import { INPUT, STATS } from "./testing.ts";

const SOUNDS = PB_DEFINITION.songDbRecordLayout.chart.sounds.offset;

const viewOf = (entry: Uint8Array) => new DataView(entry.buffer);

Deno.test("2本目のムービーは、ムービーの2番目のフィールドから参照する", () => {
  const { references } = synthesizeEntry(PB_FORMAT, {
    ...INPUT,
    videos: [8, 9].map((sourceFileIndex) => ({
      needsLargeBuffer: false,
      sourceFileIndex,
    })),
  });
  assertEquals(references.get(9), [{
    fieldOffset: PB_FORMAT.videoFieldOffset(1),
    width: "u32",
  }]);
  assertEquals(PB_FORMAT.videoFieldOffset(1), 0x5c);
});

Deno.test("譜面と音の参照欄を素材のfile index別に集める", () => {
  const { entry, references } = synthesizeEntry(PB_FORMAT, INPUT);
  assertEquals(references.get(7), [{
    fieldOffset: PB_FORMAT.chartFieldOffset("sp_normal"),
    width: "u32",
  }]);
  assertEquals(references.get(3), [{
    fieldOffset: PB_FORMAT.keysoundFieldOffset("sp_normal"),
    width: "u16",
  }]);
  assertEquals(references.size, 2);
  assertEquals(
    viewOf(entry).getUint16(PB_FORMAT.bgmFieldOffset("sp_normal"), true),
    0xffff,
  );
  assertEquals(viewOf(entry).getUint16(SOUNDS, true), 0xffff);
});

Deno.test("譜面の統計は、譜面のfile indexで引く", () => {
  const requested: number[] = [];
  synthesizeEntry(PB_FORMAT, {
    ...INPUT,
    statsOf: (fileIndex) => {
      requested.push(fileIndex);
      return STATS;
    },
  });
  assertEquals(requested, [7]);
});
