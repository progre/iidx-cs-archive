// 組のセーブの曲indexを、全世代の全曲リストだけから決める。
// 原盤を読まずに決めるので、どの原盤の組み合わせで作っても、同じ曲は同じ曲indexになる。

import {
  type CatalogGroup,
  catalogGroupsOf,
  catalogKeyOf,
  type GenerationCatalog,
  type GroupRow,
  type IsFiveKeyTwin,
  type SongKeyOf,
} from "./catalog_groups.ts";

/** PBの固定枠の数。オーナーがPBでない組の曲indexは、ここから振る */
const FIXED_SLOT_COUNT = 99;

export interface SaveSlots {
  /** 99以降の曲indexの数。原盤が欠けても、すべての原盤のときと同じである */
  count: number;
  /**
   * 組の行 → 組の曲index。キーは`catalogKeyOf`の行番号の形である。
   * オーナーがPBの組の行は持たない。その組はPBの曲の枠を使う
   */
  indexOf: ReadonlyMap<string, number>;
}

/** 自分の曲indexを持つ行と、その曲indexを引く組の行 */
interface Holder {
  holder: GroupRow;
  members: readonly GroupRow[];
}

const isFiveKeys = ({ row }: GroupRow) => row.front?.fiveKeys === true;

/**
 * 組の中で、自分の曲indexを持つ行。選曲リストの窓に置く曲である。
 * - オーナー(PBを除く)。裏は、オーナーの曲indexを引く
 * - 原作の5鍵盤版。`five_keys`の行は、その裏になるので、5鍵盤版の曲indexを引く
 * - 原作の5鍵盤版が無い組の`five_keys`の行。表の5鍵盤版になる
 */
function holdersOf({ others, owner, twin }: CatalogGroup): Holder[] {
  const fiveKeys = others.filter(isFiveKeys);
  const backs = [owner, ...others.filter((row) => !isFiveKeys(row))];
  return [
    ...(owner.generation === "pb" ? [] : [{ holder: owner, members: backs }]),
    ...(twin === undefined
      ? fiveKeys.map((row) => ({ holder: row, members: [row] }))
      : [{ holder: twin, members: [twin, ...fiveKeys] }]),
  ];
}

/**
 * `catalogs`は、全世代の全曲リストを、ファイルの順に並べる。
 * 自分の曲indexを持つ行に、全曲リストのファイルの順・行の順で、99から曲indexを振る。
 * 全曲リストの行は曲番号の順に並ぶので、この順は、原盤から作る曲の並び(世代の順・曲番号の順)と同じである
 */
export function saveSlotsOf(
  catalogs: readonly GenerationCatalog[],
  keyOf: SongKeyOf,
  isTwin: IsFiveKeyTwin,
): SaveSlots {
  const fileIndexOf = (generation: string) =>
    catalogs.findIndex((catalog) => catalog.generation === generation);
  const holders = catalogGroupsOf(catalogs, keyOf, isTwin)
    .flatMap(holdersOf)
    .toSorted(({ holder: a }, { holder: b }) =>
      fileIndexOf(a.generation) - fileIndexOf(b.generation) ||
      a.row.line - b.row.line
    );
  const indexOf = new Map(
    holders.flatMap(({ members }, at) =>
      members.map(({ generation, row }) => [
        catalogKeyOf(generation, 0, row.line),
        FIXED_SLOT_COUNT + at,
      ])
    ),
  );
  return { count: holders.length, indexOf };
}
