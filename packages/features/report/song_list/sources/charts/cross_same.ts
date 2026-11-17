// 同じ曲の別の版どうしで、難易度をまたいで同じ譜面を探す。同じ難易度どうしは chart_groups.ts が比べる。
// 移して結んだ譜面は、移し先の難易度で比べてあるので探さない。

import type { ChartShape } from "@csa/core";
import { sameShape } from "./shape_compare.ts";

/** 曲リストに載る曲1つ */
export interface ChartOwner {
  generation: string;
  key: string;
  /** 全曲リストで外した譜面の難易度名 */
  excludedCharts?: readonly string[];
  /** 曲リストに載せるが、CSA に収録しない曲 */
  removed?: true;
  /** 裏の曲として、別の難易度へ移した譜面。移し先の難易度 → 移し元の難易度 */
  moves?: Readonly<Record<string, string>>;
  songId: number;
}

export const idOf = ({ generation, songId }: ChartOwner) =>
  `${generation}:${songId}`;

/** 版ごとの、難易度名 → 譜面の形 */
export type VersionShapes = {
  id: string;
  shapes: Record<string, ChartShape>;
}[];

/** 移した譜面の`世代:song_id/移し元の難易度>移し先の難易度`。版が表と裏の2行に載れば、両方の行から集める */
export const linksOf = (versions: readonly ChartOwner[]) =>
  new Set(
    versions.flatMap((version) =>
      Object.entries(version.moves ?? {}).map(([to, from]) =>
        `${idOf(version)}/${from}>${to}`
      )
    ),
  );

/**
 * 版も難易度も違うのに同じ譜面である組。組の値は`世代:song_id/難易度名`である。
 * 組は`[裏, 表]`の順に持つ。`表`は、2つの版のうち表に選ばれやすい版である。
 * 呼び出し側は、表に選ばれやすい版から順に`versions`を並べる
 */
export function crossPairsOf(
  versions: VersionShapes,
  links: ReadonlySet<string>,
): [string, string][] {
  const charts = versions.flatMap(({ id, shapes }, rank) =>
    Object.entries(shapes).map(([name, shape]) => ({ id, name, rank, shape }))
  );
  type Chart = typeof charts[number];
  const linked = (a: Chart, b: Chart) =>
    links.has(`${a.id}/${a.name}>${b.name}`) ||
    links.has(`${b.id}/${b.name}>${a.name}`);
  return charts.flatMap((back) =>
    charts
      .filter((front) =>
        front.rank < back.rank && front.name !== back.name &&
        !linked(back, front) && sameShape(front.shape, back.shape)
      )
      .map((front): [string, string] => [
        `${back.id}/${back.name}`,
        `${front.id}/${front.name}`,
      ])
  );
}

/**
 * 難易度をまたいで同じ譜面のうち、どちらも選べる組を1組1行で書く。
 * キー音やオーバーレイが違えば両方の版を残すこともあるので、どちらを残すかは人が決める
 */
export function unlinkedSameOf(
  owners: readonly ChartOwner[],
  pairs: readonly [string, string][],
): string[] {
  const keys = new Map(owners.map((owner) => [idOf(owner), owner.key]));
  // 同じ版が表と裏の2行に載るので、どれか1行で選べればよい
  const selectable = (chart: string) => {
    const [id, name] = chart.split("/");
    return owners.some((owner) =>
      idOf(owner) === id && owner.removed === undefined &&
      !(owner.excludedCharts ?? []).includes(name)
    );
  };
  return pairs
    .filter((pair) => pair.every(selectable))
    .map(([back, front]) =>
      `${keys.get(back.split("/")[0])} ${back} = ${front}`
    )
    .sort();
}
