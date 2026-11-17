// 表の曲が持たない難易度を、組のどの裏から出すかを決める。
// ゲームでは、裏の対応表の stub が、表の曲ごとに1曲の「鳴らす裏」を選ぶ。
// 鳴らす裏が持たない難易度では、番号が最も小さい候補の裏を選ぶ。
// 曲リストとゲームが食い違わないよう、出す裏は stub と同じ規則で決める。

import type { ManifestPbBack, ManifestVariant } from "@csa/core";
import type { HasChart } from "./moved_charts.ts";

/** 選んで出す裏1曲 */
export interface FillBack {
  /** 表の曲の難易度 → それを出すこの裏の難易度。全曲リストの`front_charts` */
  frontCharts: Record<string, string>;
  frontIndex: number;
  generation: string;
  /** 裏の曲index */
  index: number;
  position: number;
}

export interface Fill {
  /** `frontCharts`へ足す組 */
  added: Record<string, string>;
  forcedBack?: true;
}

/** DP BEGINNER は通常の選曲で選べないので埋めない(2026-10-31、ユーザー判断) */
const fillableOf = (chartSlots: readonly string[]) =>
  chartSlots.filter((name) => name !== "dp_beginner");

/**
 * 裏の曲index → 足す組。鳴らす裏は、表に無い難易度を持つ裏のうち最も後の作品の裏にする。
 * 鳴らす裏が、ほかの裏から出す難易度の候補にもなるときは、stub がそちらでも鳴らす裏を選ぶ。
 * そのときは鳴らす裏を決めず、どの難易度も番号が最も小さい候補から出す
 */
export function chartFills(
  backs: readonly FillBack[],
  hasChart: HasChart,
  orderOf: (generation: string) => number,
  chartSlots: readonly string[],
): Map<number, Fill> {
  const fillable = fillableOf(chartSlots);
  const fills = new Map<number, Fill>();
  for (const [front, group] of Map.groupBy(backs, (back) => back.frontIndex)) {
    // ほかの難易度へ出している譜面は、移した後で消えるので持たない
    const has = (back: FillBack, name: string) =>
      hasChart(back.index, name) &&
      !Object.values(back.frontCharts).includes(name);
    const candidate = (back: FillBack, name: string) =>
      has(back, name) || back.frontCharts[name] !== undefined;
    // 表の曲が持つ難易度の組は、裏の中で移すだけなので、鳴らす裏の選び方に関わらない
    const written = group.flatMap((back) =>
      Object.keys(back.frontCharts)
        .filter((name) => !hasChart(front, name))
        .map((name) => ({ back, name }))
    );
    const missing = fillable.filter((name) =>
      !hasChart(front, name) && !written.some((each) => each.name === name)
    );
    const latest = group
      .toSorted((a, b) => orderOf(b.generation) - orderOf(a.generation))
      .find((back) => missing.some((name) => has(back, name)));
    const first = (name: string) =>
      group.toSorted((a, b) => a.position - b.position)
        .find((back) => has(back, name));
    const assign = (forced: FillBack | undefined) =>
      missing.flatMap((name) => {
        const back = forced !== undefined && has(forced, name)
          ? forced
          : first(name);
        return back === undefined ? [] : [{ back, name }];
      });
    const tried = assign(latest);
    const conflicts = latest !== undefined &&
      [...written, ...tried].some(({ back, name }) =>
        back !== latest && candidate(latest, name)
      );
    const forced = conflicts ? undefined : latest;
    for (const { back, name } of conflicts ? assign(undefined) : tried) {
      const fill = fills.get(back.index) ?? { added: {} };
      fill.added[name] = name;
      fills.set(back.index, fill);
    }
    if (forced !== undefined && fills.has(forced.index)) {
      fills.get(forced.index)!.forcedBack = true;
    }
  }
  return fills;
}

/** 表の曲の中で移す組(`movedCharts`)を数え、移した後の譜面を持つとみなす */
export function withOwnMoves(
  songs: readonly {
    movedCharts?: Record<string, string>;
    targetSongIndex: number;
  }[],
  hasChart: HasChart,
): HasChart {
  const moves = new Map(
    songs.flatMap((song) =>
      song.movedCharts === undefined
        ? []
        : [[song.targetSongIndex, song.movedCharts] as const]
    ),
  );
  return (index, name) => {
    const moved = moves.get(index) ?? {};
    if (moved[name] !== undefined) {
      return hasChart(index, moved[name]);
    }
    return !Object.values(moved).includes(name) && hasChart(index, name);
  };
}

interface FillableSong {
  movedCharts?: Record<string, string>;
  sourceGeneration: string;
  targetSongIndex: number;
  variantOf?: ManifestVariant;
}

/**
 * manifest の裏の曲と PB 原盤の曲の写しの裏に、`chartFills`の結果を書く。
 * 表の曲の中で移す組(`movedCharts`)は、移した後の譜面を持つとみなす。
 * PB の写しの裏の譜面は、`pbHasChart`で PB の曲の song_id から引く
 */
export function withChartFills<T extends FillableSong>(
  songs: readonly T[],
  pbBacks: readonly ManifestPbBack[],
  hasChart: HasChart,
  pbHasChart: (songId: number, name: string) => boolean,
  orderOf: (generation: string) => number,
  chartSlots: readonly string[],
): { pbBacks: ManifestPbBack[]; songs: T[] } {
  const pbSongIdOf = new Map(
    pbBacks.map((back) => [back.targetSongIndex, back.songId]),
  );
  const moved = withOwnMoves(songs, hasChart);
  const has: HasChart = (index, name) => {
    const songId = pbSongIdOf.get(index);
    return songId === undefined ? moved(index, name) : pbHasChart(songId, name);
  };
  const fills = chartFills(
    [
      ...songs.flatMap((song) => {
        const variant = song.variantOf;
        return variant?.rule !== "custom" ? [] : [{
          frontCharts: variant.frontCharts ?? {},
          frontIndex: variant.targetSongIndex,
          generation: song.sourceGeneration,
          index: song.targetSongIndex,
          position: variant.position ?? 0,
        }];
      }),
      ...pbBacks.map((back) => ({
        frontCharts: back.frontCharts ?? {},
        frontIndex: back.songId,
        generation: "pb",
        index: back.targetSongIndex,
        position: back.position,
      })),
    ],
    has,
    orderOf,
    chartSlots,
  );
  const filled = <V extends { frontCharts?: Record<string, string> }>(
    value: V,
    index: number,
  ): V => {
    const fill = fills.get(index);
    return fill === undefined ? value : {
      ...value,
      frontCharts: { ...value.frontCharts, ...fill.added },
      ...(fill.forcedBack ? { forcedBack: true } : {}),
    };
  };
  return {
    pbBacks: pbBacks.map((back) => filled(back, back.targetSongIndex)),
    songs: songs.map((song) =>
      song.variantOf === undefined
        ? song
        : { ...song, variantOf: filled(song.variantOf, song.targetSongIndex) }
    ),
  };
}
