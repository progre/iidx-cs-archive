// 一覧の総数。曲数と譜面数を数える。全曲リストで外した譜面は CSA に入らないので数えない。

import type { SongRow } from "../types.ts";

export interface SummaryView {
  added: number;
  charts: number;
  original: number;
  songs: number;
}

export function summaryOf(songs: readonly SongRow[]): SummaryView {
  const original = songs.filter((song) => song.original).length;
  return {
    added: songs.length - original,
    charts: songs.reduce(
      (sum, song) =>
        sum + Object.values(song.charts).filter((chart) => !chart.excluded)
          .length,
      0,
    ),
    original,
    songs: songs.length,
  };
}
