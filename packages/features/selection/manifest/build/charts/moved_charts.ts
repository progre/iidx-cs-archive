// 全曲リストの`front_charts`の組を、表の曲が左の難易度を持つかどうかで分ける。
// 持たない組は、表の曲のその難易度を裏の曲の譜面で出す(`frontCharts`)。
// 持つ組は、裏の曲の中で譜面を左の難易度へ移す(`movedCharts`)。

import type { FinishedSong, ManifestVariant, SongmapSong } from "@csa/core";
import type { ChartPorts } from "./ports.ts";

/** 曲indexの曲が、その難易度の譜面を持つか */
export type HasChart = (targetSongIndex: number, name: string) => boolean;

export function withMovedCharts<T extends { variantOf?: ManifestVariant }>(
  songs: readonly T[],
  hasChart: HasChart,
): T[] {
  return songs.map((song) => {
    const variant = song.variantOf;
    if (variant?.frontCharts === undefined) {
      return song;
    }
    const pairs = Object.entries(variant.frontCharts);
    const has = ([front]: [string, string]) =>
      hasChart(variant.targetSongIndex, front);
    if (!pairs.some(has)) {
      return song;
    }
    const { frontCharts: _, ...rest } = variant;
    const kept = pairs.filter((pair) => !has(pair));
    return {
      ...song,
      variantOf: {
        ...rest,
        ...(kept.length === 0 ? {} : { frontCharts: Object.fromEntries(kept) }),
        movedCharts: Object.fromEntries(pairs.filter(has)),
      },
    };
  });
}

/**
 * 載せる曲は、曲DBエントリーのレベルが0より大きく、全曲リストで外していない譜面を持つ。
 * 裏の曲も、自分の曲indexで引ける。
 * PB原盤の曲(曲indexがsong_idの曲)は、songmapの譜面を持つ
 */
export function hasChartOf(
  songs: readonly FinishedSong[],
  pbSongs: readonly SongmapSong[],
  levelOf: ChartPorts["levelOf"],
): HasChart {
  const listed = new Map(songs.map((song) => [song.targetSongIndex, song]));
  return (index, name) => {
    const song = listed.get(index);
    if (song === undefined) {
      return pbSongs.find((pb) => pb.song_id === index)?.charts[name] !==
        undefined;
    }
    // レベル欄は符号付きで、-1の曲もある
    return levelOf(song.entry, name) > 0 &&
      !(song.excludedCharts ?? []).includes(name);
  };
}
