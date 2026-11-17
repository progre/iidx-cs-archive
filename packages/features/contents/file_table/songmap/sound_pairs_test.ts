import { assertEquals } from "@std/assert";
import { songmapOf } from "./build.ts";
import { CHART_SLOTS, definitionOf, elfOf, recordOf } from "./testing.ts";
import type { SongmapRecord } from "./types.ts";

const NONE = 0xffff;

function soundsOf(record: SongmapRecord) {
  const doc = songmapOf({
    elf: elfOf([{ offset: 0x10, sizes: [1, 2, 3, 4, 5, 6] }]),
    def: definitionOf(
      [{ fileName: "A.BIN", offset: 0x10, count: 6 }],
      { elfPointers: false, videoRule: null },
    ),
    rule: {
      archiveOrder: [0],
      chartSlots: CHART_SLOTS,
      videoPlan: "primary",
      levelIndexOf: { sp_hyper: 0, dp_hyper: 1, sp_another: 0, dp_another: 1 },
      title: { source: "pointer" },
      chartArchive: null,
      soundPlan: "paired",
    },
    records: [record],
  });
  return doc.songs[0].sounds;
}

Deno.test("ANOTHERのフィールドにBGMだけがあれば、キー音が無くてもANOTHERのBGMとして読む", () => {
  const sounds = soundsOf(recordOf({
    title: "T",
    sounds: [0, NONE, 1, NONE, NONE, NONE, 2, NONE],
  }));
  assertEquals(sounds, [
    { pair: "sp_hyper", keysound: 0, bgm: 1 },
    { pair: "sp_another", keysound: null, bgm: 2 },
  ]);
});

Deno.test("DP HYPERのフィールドにBGMだけがあれば、DP HYPERのBGMとして読む", () => {
  const sounds = soundsOf(recordOf({
    title: "T",
    sounds: [0, NONE, 1, 2, NONE, NONE, NONE, NONE],
  }));
  assertEquals(sounds, [
    { pair: "sp_hyper", keysound: 0, bgm: 1 },
    { pair: "dp_hyper", keysound: null, bgm: 2 },
  ]);
});

Deno.test("ANOTHER専用のBGMのフィールドに正の値があれば、SP ANOTHERのBGMとして読む", () => {
  const sounds = soundsOf(recordOf({
    title: "T",
    sounds: [0, NONE, 1, NONE],
    anotherBgm: 2,
  }));
  assertEquals(sounds, [
    { pair: "sp_hyper", keysound: 0, bgm: 1 },
    { pair: "sp_another", keysound: null, bgm: 2 },
  ]);
});

for (const anotherBgm of [NONE, 0]) {
  Deno.test(`ANOTHER専用のBGMのフィールドが${anotherBgm}なら、BGMを足さない`, () => {
    const sounds = soundsOf(recordOf({
      title: "T",
      sounds: [0, NONE, 1, NONE],
      anotherBgm,
    }));
    assertEquals(sounds, [{ pair: "sp_hyper", keysound: 0, bgm: 1 }]);
  });
}
