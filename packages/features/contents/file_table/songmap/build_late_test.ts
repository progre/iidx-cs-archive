// 9th以降とUSの読み方。曲DBの値は合成する。

import { assertEquals } from "@std/assert";
import { songmapOf } from "./build.ts";
import { CHART_SLOTS, definitionOf, elfOf, recordOf } from "./testing.ts";
import type { SongmapRule } from "./types.ts";

const NONE = 0xffff;

const ELF = elfOf([{ offset: 0x10, sizes: [1, 2, 3, 4, 5, 6, 7, 8] }]);
const DEFINITION = definitionOf(
  [{ fileName: "A.DAT", offset: 0x10, count: 8 }],
  { elfPointers: false, videoRule: null },
);

const LATE: SongmapRule = {
  archiveOrder: [0],
  chartSlots: CHART_SLOTS,
  videoPlan: "firstWithTwin",
  levelIndexOf: { sp_hyper: 0, sp_beginner: "beginner" },
  title: { source: "embedded", encoding: "shift-jis", indexPrefix: false },
  chartArchive: null,
  soundPlan: "paired",
};

Deno.test("譜面の番号は通し番号で、題名は前後のNULと空白を落とす", () => {
  const doc = songmapOf({
    elf: ELF,
    def: DEFINITION,
    rule: { ...LATE, archiveNames: "lowercase" },
    records: [
      recordOf({
        title: "",
        embedded: "\0 Title \0\0",
        levels: [7],
        beginnerLevel: 0,
        charts: [3, 0, 0, 0, 0, 0, 4],
      }),
    ],
  });
  assertEquals(doc.archives, ["a.dat"]);
  assertEquals(doc.songs.at(0)?.title, "Title");
  assertEquals(doc.songs.at(0)?.charts, {
    sp_beginner: { chart: 4, level: [0] },
    sp_hyper: { chart: 3, level: 7 },
  });
});

Deno.test("題名が空なら曲の番号を使い、全角チルダは波ダッシュにする", () => {
  const doc = songmapOf({
    elf: ELF,
    def: DEFINITION,
    rule: LATE,
    records: [
      recordOf({ title: "", embedded: "\0\0" }),
      recordOf({ title: "", embedded: "A～B" }),
    ],
  });
  assertEquals(doc.songs.map((song) => song.title), ["0", "A〜B"]);
});

Deno.test("2本目のムービーは、1本目と違うファイルのときだけ引く。同じファイルなら2本目の番号で名付ける", () => {
  const doc = songmapOf({
    elf: ELF,
    def: DEFINITION,
    rule: LATE,
    records: [
      recordOf({ title: "T", video: [5, 5] }),
      recordOf({ title: "U", video: [0, 6] }),
      recordOf({ title: "V", video: [NONE, 6] }),
      recordOf({ title: "W", video: [7, 0] }),
    ],
  });
  assertEquals(doc.files.at(5)?.refs, ["T [1].mpg"]);
  assertEquals(doc.files.at(0)?.refs, ["U [0].mpg"]);
  assertEquals(doc.files.at(6)?.refs, ["U [1].mpg"]);
  assertEquals(doc.songs.map((song) => song.videos), [[5], [0, 6], [], [7]]);
});

const US: SongmapRule = {
  ...LATE,
  chartSlots: ["sp_normal", "dp_normal"],
  levelIndexOf: { sp_normal: 0, dp_normal: 1 },
  title: { source: "embedded", encoding: "shift-jis", indexPrefix: true },
  soundPlan: "perChart",
};

Deno.test("USは、題名の前置きを落とし、組が空の枠は先頭の組を使う", () => {
  const doc = songmapOf({
    elf: ELF,
    def: DEFINITION,
    rule: US,
    records: [
      recordOf({
        title: "",
        embedded: "101 726_fly through\0",
        levels: [6, 8],
        charts: [4, 5],
        sounds: [2, NONE, 3, NONE],
      }),
    ],
  });
  assertEquals(doc.songs.at(0)?.title, "fly through");
  assertEquals(doc.files.at(2)?.refs, [
    "fly through [0].wvb",
    "fly through [1].wvb",
  ]);
  assertEquals(doc.files.at(3)?.refs, [
    "fly through [0].pcm",
    "fly through [1].pcm",
  ]);
  assertEquals(doc.songs.at(0)?.sounds, [
    { pair: "sp_normal", keysound: 2, bgm: 3 },
    { pair: "dp_normal", keysound: 2, bgm: 3 },
  ]);
  assertEquals(Object.keys(doc.songs.at(0)?.charts ?? {}), [
    "sp_normal",
    "dp_normal",
  ]);
});
