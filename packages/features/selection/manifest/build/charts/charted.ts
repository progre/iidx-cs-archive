// 載せる曲と PB 原盤の曲の写しの裏に、表の曲が持たない難易度の出し方と、裏の中で移す譜面を書く。

import type { FinishedSong, ManifestPbBack, SongmapSong } from "@csa/core";
import { withChartFills, withOwnMoves } from "./filled_charts.ts";
import { hasChartOf, withFrontFills } from "./front_fills.ts";
import type { ChartPorts } from "./ports.ts";

/** 表に無い難易度を埋めるときは、PB を最も後に、us を最も前に数える */
const orderOf =
  ({ generations, pbGeneration }: ChartPorts) => (generation: string) =>
    generation === pbGeneration
      ? generations.length
      : generation === "us"
      ? -1
      : generations.indexOf(generation);

export function chartedSongs(
  finished: FinishedSong[],
  pbBacks: readonly ManifestPbBack[],
  pbSongs: readonly SongmapSong[],
  ports: ChartPorts,
): { pbBacks: ManifestPbBack[]; songs: FinishedSong[] } {
  const hasChart = hasChartOf(finished, pbSongs, ports.levelOf);
  const pbHasChart = (songId: number, name: string) =>
    pbSongs.find((song) => song.song_id === songId)?.charts[name] !==
      undefined;
  const filled = withChartFills(
    finished,
    pbBacks,
    hasChart,
    pbHasChart,
    orderOf(ports),
    ports.chartSlots,
  );
  return {
    pbBacks: filled.pbBacks,
    songs: withFrontFills(filled.songs, withOwnMoves(finished, hasChart)),
  };
}
