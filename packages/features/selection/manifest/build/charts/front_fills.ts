// 裏の曲の`chartMoves`のうち、表の曲が持たない難易度へ移す組を`frontFills`に書く。
// その組は、表の曲のその難易度を裏の曲の譜面で出す。
// ほかの組は、裏の曲の中で譜面を移すだけである。

import type { FinishedSong, ManifestVariant, SongmapSong } from "@csa/core";
import type { ChartPorts } from "./ports.ts";

/** 曲indexの曲が、その難易度の譜面を持つか */
export type HasChart = (targetSongIndex: number, name: string) => boolean;

export function withFrontFills<T extends { variantOf?: ManifestVariant }>(
  songs: readonly T[],
  hasChart: HasChart,
): T[] {
  return songs.map((song) => {
    const variant = song.variantOf;
    if (variant?.chartMoves === undefined) {
      return song;
    }
    const fills = Object.keys(variant.chartMoves).filter((to) =>
      !hasChart(variant.targetSongIndex, to)
    );
    return fills.length === 0
      ? song
      : { ...song, variantOf: { ...variant, frontFills: fills } };
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
