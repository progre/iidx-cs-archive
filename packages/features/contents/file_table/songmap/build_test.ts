import { assertEquals } from "@std/assert";
import { songmapOf } from "./build.ts";
import { CHART_SLOTS, definitionOf, elfOf, recordOf } from "./testing.ts";
import type { SongmapRule } from "./types.ts";

const LEVELS = {
  sp_hyper: 0,
  sp_normal: 1,
};

const FULL_TITLE = { source: "full", encoding: "euc-jp" } as const;

Deno.test("pointerの規則では、完全な題名でなく曲DBの題名の欄を題名にする", () => {
  const doc = songmapOf({
    elf: elfOf([{ offset: 0x10, sizes: [100] }]),
    def: definitionOf(
      [{ fileName: "A.BIN", offset: 0x10, count: 1 }],
      { elfPointers: true, videoRule: null },
    ),
    rule: {
      archiveOrder: [0],
      chartSlots: CHART_SLOTS,
      videoPlan: "derived",
      levelIndexOf: LEVELS,
      title: { source: "pointer" },
      chartArchive: null,
      soundPlan: "paired",
    },
    records: [recordOf({ title: "Long (MIX)", text: " SHORT " })],
  });
  assertEquals(doc.songs.map(({ title }) => title), ["SHORT"]);
});

Deno.test("ELF内の譜面は、ファイル表の後ろへ追加し、2本目のムービーは続き番号で引く", () => {
  const rule: SongmapRule = {
    archiveOrder: [0],
    chartSlots: CHART_SLOTS,
    videoPlan: "derived",
    levelIndexOf: LEVELS,
    title: FULL_TITLE,
    chartArchive: null,
    soundPlan: "paired",
  };
  const doc = songmapOf({
    elf: elfOf([{ offset: 0x10, sizes: [100, 200, 300] }]),
    def: definitionOf(
      [{ fileName: "A.BIN", offset: 0x10, count: 3 }],
      { elfPointers: true, videoRule: null },
    ),
    rule,
    records: [
      recordOf({
        title: "T",
        levels: [7, 3],
        video: [0],
        charts: [0x120, 0, 0xffffffff],
        sounds: [2, 0xffff, 0xffff, 0xffff],
      }),
    ],
  });
  assertEquals(doc.archives, ["A.BIN", "ELF"]);
  assertEquals(doc.files.at(3), {
    index: 3,
    archive: "ELF",
    offset: 0x20,
    size: 0x400 - 0x120 - 0x100,
    refs: ["T [SP HYPER].ply"],
  });
  assertEquals(doc.files.at(0)?.refs, ["T [0].mpg"]);
  assertEquals(doc.files.at(1)?.refs, ["T [1].mpg"]);
  assertEquals(doc.songs, [{
    song_id: 0,
    title: "T",
    charts: { sp_hyper: { chart: 3, level: 7 } },
    sounds: [{ pair: "sp_hyper", keysound: 2, bgm: null }],
    keysound: 2,
    bgm: null,
    videos: [0, 1],
    overlay: null,
  }]);
});

Deno.test("2つ目のアーカイブの件数以上の番号は3つ目を引き、通し番号はB・C・Aの順になる", () => {
  const rule: SongmapRule = {
    archiveOrder: [1, 2, 0],
    chartSlots: CHART_SLOTS,
    videoPlan: "primary",
    levelIndexOf: LEVELS,
    title: FULL_TITLE,
    chartArchive: 2,
    soundPlan: "paired",
  };
  const doc = songmapOf({
    elf: elfOf([
      { offset: 0x10, sizes: [10, 11] },
      { offset: 0x40, sizes: [20] },
      { offset: 0x80, sizes: [30, 31, 32] },
    ]),
    def: definitionOf(
      [
        { fileName: "A.BIN", offset: 0x10, count: 2 },
        { fileName: "B.BIN", offset: 0x40, count: 1 },
        { fileName: "C.BIN", offset: 0x80, count: 3 },
      ],
      { elfPointers: false, videoRule: "overlap" },
    ),
    rule,
    records: [
      recordOf({
        title: "T",
        levels: [5, 0],
        video: [1],
        charts: [0x10000002],
        overlay: 2,
      }),
    ],
  });
  assertEquals(doc.files.map((file) => file.archive), [
    "B.BIN",
    "C.BIN",
    "C.BIN",
    "C.BIN",
    "A.BIN",
    "A.BIN",
  ]);
  // 件数1のBに対し、1は3つ目のアーカイブの1番(通し番号2)になる
  assertEquals(doc.songs.at(0)?.videos, [2]);
  assertEquals(doc.songs.at(0)?.overlay, 3);
  assertEquals(doc.songs.at(0)?.charts, { sp_hyper: { chart: 3, level: 5 } });
});
