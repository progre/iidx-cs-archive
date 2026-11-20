// 曲リストのデータの、列・並び・行の種類ごとの欄を確かめる。

import { assertEquals, assertThrows } from "@std/assert";
import type { ListEntry, SongmapSong } from "@csa/core";
import type { RowPorts } from "../ports.ts";
import { songListData as dataOf } from "../sources/mod.ts";
import { type SortedRow, withFrontFills, withMovedCharts } from "./rows/mod.ts";
import type {
  ListedExcludedSong,
  ListedPbSong,
  ListedSong,
  SongListInput,
} from "./input.ts";

const FOLDER = 10;
const folderShort = (folder: number) => `f${folder}`;

const ports: RowPorts = {
  abcIndexOfAsset: () => 0,
  catalogKeyOf: (generation, songId) => `${generation}:${songId}`,
  chartSlots: [
    "sp_hyper",
    "dp_hyper",
    "sp_another",
    "dp_another",
    "sp_normal",
    "dp_normal",
    "sp_beginner",
    "dp_beginner",
    "sp_black",
    "dp_black",
  ],
  fallbackVideoAbcIndex: 0,
  folderShort,
  newAbcIndices: () => [],
  sourceFolderOf: () => undefined,
};
const songListData = (data: SongListInput) => dataOf(ports, data);

const shownOf = (sortKey: string): ListEntry => ({
  folder: FOLDER,
  levels: { sp_hyper: 5 },
  notes: { sp_hyper: 100 },
  sortKey,
  videoAbcIndex: 1,
});

const added: ListedSong = {
  chartPrints: {},
  assets: [],
  canonicalKey: "ADDED",
  chartNames: ["sp_hyper"],
  entry: "",
  shown: shownOf("B"),
  sourceGeneration: "9th",
  sourceOverlay: { packages: [7], sheets: 3 },
  sourceSongIndex: 1,
  sourceVersion: 9,
  targetSongIndex: 0,
  title: "ADDED",
  videoFields: [],
};

const excluded: ListedExcludedSong = {
  chartPrints: {},
  assets: [],
  canonicalKey: "EXCLUDED",
  shown: shownOf("C"),
  sourceGeneration: "4th",
  sourceOverlay: { packages: [], sheets: 2 },
  sourceSongIndex: 2,
  title: "EXCLUDED",
  videoFields: [],
};

const pb: ListedPbSong = {
  chartPrints: {},
  key: "PB",
  overlay: { packages: [], sheets: 0 },
  shown: shownOf("A"),
  song: {
    charts: { sp_hyper: {} },
    song_id: 3,
    sounds: [],
    title: "PB",
    videos: [],
  } as unknown as SongmapSong,
};

const input = (rest: Partial<SongListInput> = {}): SongListInput => ({
  contentPrints: new Map(),
  excluded: [excluded],
  label: "test",
  lengths: new Map([["pb:1", 10], ["if:9th:7", 20]]),
  manifest: { songs: [added] } as SongListInput["manifest"],
  movieAliases: new Map(),
  pbSongs: [pb],
  soundPrints: new Map(),
  subtitles: new Map(),
  editions: new Map(),
  ...rest,
});

Deno.test("難易度の列は難易度順に並び、譜面スロット番号を併記する", () => {
  const data = songListData(input({ excluded: [], pbSongs: [] }));
  assertEquals(
    data.difficulties.map((each) => `${each.slot}=${each.label}`).join(" "),
    "6=SB 4=SN 0=SH 2=SA 8=SX 7=?? 5=DN 1=DH 3=DA 9=DX",
  );
});

Deno.test("裏の曲の中で移した譜面は移し先の欄に入れ、自前の譜面には印だけを付ける", () => {
  const n = { level: 5, notes: 301 };
  const a = { level: 9, notes: 700 };
  const { charts, movedIn } = withMovedCharts(
    { sp_another: a, sp_normal: n },
    { sp_another: "sp_normal", sp_hyper: "sp_another" },
  );
  assertEquals(charts, {
    sp_another: { ...a, linked: true },
    sp_normal: { ...n, linked: true },
  });
  assertEquals(movedIn, {
    sp_another: { ...n, from: { chart: "sp_normal" } },
    sp_hyper: { ...a, from: { chart: "sp_another" } },
  });
});

Deno.test("表の曲の行に裏の曲で出す譜面を足し、同じ欄に2つ入るなら例外にする", () => {
  const own = { level: 4, notes: 300 };
  const sb = {
    chart: { from: { chart: "sp_beginner" }, level: 2, notes: 100 },
    name: "sp_beginner",
    saveIndex: 7,
  };
  const row = (saveIndex: number) =>
    ({
      row: { charts: { sp_beginner: own }, saveIndex },
    }) as unknown as SortedRow;
  const [front, other] = withFrontFills([row(7), row(8)], [sb]);
  assertEquals([front.row.charts.sp_beginner, front.row.movedIn?.sp_beginner], [
    own,
    sb.chart,
  ]);
  assertEquals(other.row.movedIn, undefined);
  assertThrows(() => withFrontFills([row(7)], [sb, sb]));
});

Deno.test("PB原盤の曲・収録する曲・外した曲を、並びキーの順に並べる", () => {
  const data = songListData(input());
  assertEquals(data.songs.map((song) => song.key), ["PB", "ADDED", "EXCLUDED"]);
});

Deno.test("行の種類ごとに、原盤の曲か・選曲リストに並ぶか・外した曲かを決める", () => {
  const [pbRow, addedRow, excludedRow] = songListData(input()).songs;
  assertEquals(
    [pbRow.original, pbRow.sourceFolder, pbRow.inSelectList],
    [true, folderShort(FOLDER), true],
  );
  assertEquals([addedRow.original, addedRow.inSelectList], [false, true]);
  assertEquals(
    [excludedRow.inSelectList, excludedRow.removed],
    [false, true],
  );
});

Deno.test("オーバーレイの容量は長さから引き、パッケージが無ければ枚数も0にする", () => {
  const [, addedRow, excludedRow] = songListData(input()).songs;
  assertEquals(
    [addedRow.overlayPackages, addedRow.overlaySheets],
    [[{ bytes: 20, id: "9th:7" }], 3],
  );
  assertEquals([excludedRow.overlayPackages, excludedRow.overlaySheets], [
    [],
    0,
  ]);
});
