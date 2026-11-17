// 同じ曲の版どうしで、難易度ごとに同じ譜面の集まりを作る。曲リストは、集まりを`same`として譜面に書く。
// あわせて、表にする版の譜面と比べた結果を作る。曲リストは、これを`compare`として譜面に書く。
// 難易度をまたいで同じ譜面も、別の版から探す(`cross_same.ts`)。曲リストは、これを`sameIn`として譜面に書く。
// 同じ曲かどうかは、管理名から作るキーで見分ける。

import type { ChartPrint, ChartShape } from "@csa/core";
import type { ChartPrintsOf, ChartShapesOf } from "../../ports.ts";
import { compareShape, sameShape } from "./shape_compare.ts";
import { type ChartOwner, crossPairsOf, idOf, linksOf } from "./cross_same.ts";

type Comparison = NonNullable<ChartPrint["compare"]>;

/** 表にする版を選ぶ順。pb、新しい世代の順で、us は最後にする */
const rankOf = (generations: readonly string[], generation: string) =>
  generation === "pb"
    ? generations.length
    : generation === "us"
    ? -1
    : generations.indexOf(generation);

/** 版どうしで比べた結果。キーはどちらも`世代:song_id/難易度名`である */
export interface ChartGroups {
  /** 表にする版の譜面と比べた結果。表にする版の譜面自身は持たない */
  comparisons: Map<string, Comparison>;
  /** 移した譜面の比較結果。移し先の難易度名で引き、その難易度で表にする版の譜面と比べる */
  moved: Map<string, Record<string, Comparison>>;
  /**
   * 集まりの`世代:song_id`。
   * 集まりの値は、集まりに最初に入った版である。版は表にする版を選ぶ順に入れる
   */
  groups: Map<string, string>;
  /** 難易度をまたいで同じ譜面。移して結んだ譜面は持たない */
  sameIn: Map<string, string[]>;
  /**
   * `sameIn`の組。組は`[裏, 表]`の順に持つ。
   * `表`は、2つの版のうち表に選ばれやすい版である。選ぶ順は`rankOf`が決める
   */
  samePairs: [string, string][];
}

export function chartGroupsOf(
  owners: readonly ChartOwner[],
  shapesOf: ChartShapesOf,
  generations: readonly string[],
): ChartGroups {
  const groups = new Map<string, string>();
  const comparisons: ChartGroups["comparisons"] = new Map();
  const moved: ChartGroups["moved"] = new Map();
  const sameIn: ChartGroups["sameIn"] = new Map();
  const samePairs: ChartGroups["samePairs"] = [];
  for (const versions of Map.groupBy(owners, (owner) => owner.key).values()) {
    const fronts = new Map<string, { id: string; shape: ChartShape }>();
    const unique = [...new Map(versions.map((v) => [idOf(v), v])).values()]
      .sort((a, b) =>
        rankOf(generations, b.generation) - rankOf(generations, a.generation) ||
        a.songId - b.songId
      );
    const shapes = unique.map((v) => ({
      id: idOf(v),
      shapes: shapesOf(v.generation, v.songId),
    }));
    for (const pair of crossPairsOf(shapes, linksOf(versions))) {
      samePairs.push(pair);
      const [back, front] = pair;
      sameIn.set(back, [...sameIn.get(back) ?? [], front]);
      sameIn.set(front, [...sameIn.get(front) ?? [], back]);
    }
    const names = new Set(shapes.flatMap(({ shapes }) => Object.keys(shapes)));
    for (const name of names) {
      const heads: { id: string; shape: ChartShape }[] = [];
      for (const { id, shapes: own } of shapes) {
        const shape = own[name];
        if (shape === undefined) {
          continue;
        }
        // 最初に入った版が、この難易度で表にする版である
        const front = heads.at(0);
        if (front !== undefined) {
          comparisons.set(`${id}/${name}`, {
            against: front.id,
            result: compareShape(front.shape, shape),
          });
        }
        const head = heads.find((each) => sameShape(each.shape, shape));
        if (head === undefined) {
          heads.push({ id, shape });
        }
        groups.set(`${id}/${name}`, head?.id ?? id);
      }
      const first = heads.at(0);
      if (first !== undefined) {
        fronts.set(name, first);
      }
    }
    // 同じ版が表と裏の2行に載ることがあるので、移した譜面は重ねる前の行から集める
    for (const version of versions) {
      const own = shapesOf(version.generation, version.songId);
      for (const [to, from] of Object.entries(version.moves ?? {})) {
        const front = fronts.get(to);
        const shape = own[from];
        const id = idOf(version);
        if (front === undefined || shape === undefined || front.id === id) {
          continue;
        }
        const key = `${id}/${from}`;
        moved.set(key, {
          ...moved.get(key),
          [to]: { against: front.id, result: compareShape(front.shape, shape) },
        });
      }
    }
  }
  return { comparisons, groups, moved, sameIn, samePairs };
}

/** 譜面の中身のハッシュに、集まりと、表にする版の譜面と比べた結果を書き足す */
export const withGroups = (
  printsOf: ChartPrintsOf,
  { comparisons, groups, moved, sameIn }: ChartGroups,
): ChartPrintsOf =>
(generation, songId) =>
  Object.fromEntries(
    Object.entries(printsOf(generation, songId)).map(([name, print]) => {
      const key = `${generation}:${songId}/${name}`;
      const same = groups.get(key);
      const compare = comparisons.get(key);
      const movedTo = moved.get(key);
      const sameCharts = sameIn.get(key);
      return [name, {
        ...print,
        ...(same === undefined ? {} : { same }),
        ...(compare === undefined ? {} : { compare }),
        ...(movedTo === undefined ? {} : { moved: movedTo }),
        ...(sameCharts === undefined ? {} : { sameIn: sameCharts }),
      }];
    }),
  );
