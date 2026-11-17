// 曲の難易度ごとの譜面を、ビルドが作品ごとに書き出したLZファイルから読む。
// 全曲リストで外した譜面は`assets`に載らないので、songmap の譜面の番号から引く。

import type {
  ChartFormat,
  ChartPrint,
  ChartShape,
  SongmapSong,
} from "@csa/core";
import {
  chartPrintOfIndex,
  chartShapeOfIndex,
  type LzPlace,
} from "./lz_place.ts";

/** 周回で読んだ素材のうち、譜面を読むのに使う部分 */
export interface ChartReadSources {
  lzOf: (generation: string) => LzPlace;
  songmapOf: (generation: string) => { songs: readonly SongmapSong[] };
}

type FormatOf = (generation: string) => ChartFormat;

const chartsReader = <T>(
  chartFormatOf: FormatOf,
  { lzOf, songmapOf }: ChartReadSources,
  read: (place: LzPlace, index: number, format: ChartFormat) => T,
) =>
(generation: string, songId: number): Record<string, T> => {
  const song = songmapOf(generation).songs.find((each) =>
    each.song_id === songId
  );
  if (song === undefined) {
    throw new Error(`${generation}のsongmapに曲${songId}が無い`);
  }
  const format = chartFormatOf(generation);
  const place = lzOf(generation);
  return Object.fromEntries(
    Object.entries(song.charts).map(([name, { chart }]) => [
      name,
      read(place, chart, format),
    ]),
  );
};

export const chartPrintsReader = (
  chartFormatOf: FormatOf,
  sources: ChartReadSources,
): (generation: string, songId: number) => Record<string, ChartPrint> =>
  chartsReader(chartFormatOf, sources, chartPrintOfIndex);

export const chartShapesReader = (
  chartFormatOf: FormatOf,
  sources: ChartReadSources,
): (generation: string, songId: number) => Record<string, ChartShape> =>
  chartsReader(chartFormatOf, sources, chartShapeOfIndex);
