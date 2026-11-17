// 曲DBエントリの合成のテストが使う、組み立てた入力。原盤は読まない。
import type { ChartStats, SongmapSong } from "@csa/core";
import type { synthesizeEntry } from "./synthesize.ts";

export const STATS: ChartStats = {
  p1: 100,
  p2: 0,
  total: 100,
  p1All: 100,
  p2All: 0,
  totalAll: 100,
  bpmFirst: 150,
  bpmMin: 150,
  bpmMax: 150,
  bgmTick: 0,
  firstNoteTick: 0,
  lastTick: 0,
};

export const SONG: SongmapSong = {
  song_id: 1,
  title: "x",
  charts: { sp_normal: { chart: 7, level: [5] } },
  sounds: [{ pair: "sp_normal", keysound: 3, bgm: null }],
  keysound: null,
  bgm: null,
  videos: [],
  overlay: null,
};

export const INPUT: Parameters<typeof synthesizeEntry>[1] = {
  hasIndexPrefix: false,
  record: {
    selection: { others: 1 },
    title: { text: "abc" },
    video: { movieCountIn: null, movieLead: null, unkPb62: null },
  },
  song: SONG,
  statsOf: () => STATS,
  videos: [],
};
