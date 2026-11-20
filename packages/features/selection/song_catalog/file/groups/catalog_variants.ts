// 全曲リストの組から、原作に無い裏エントリーの組と、5鍵盤版の組を集める。

import type { CatalogFiveKey, CatalogVariant } from "@csa/core";
export type { CatalogFiveKey, CatalogVariant };
import { difficultyNamesOf } from "../../levels/mod.ts";
import {
  catalogGroupsOf,
  type FrontChooser,
  type GenerationCatalog,
  type GroupRow,
  type IsFiveKeyTwin,
  orderOf,
  ownerAsFront,
  type SongKeyOf,
  titleOf,
} from "./catalog_groups.ts";
import type { Chart } from "../csv.ts";

export type { FrontChooser, GenerationCatalog, IsFiveKeyTwin, SongKeyOf };

/** 同じ表の曲に付けられる裏の数。演奏を始めるとき、SELECT と一緒に上下と L1・R1 を押して選ぶ */
const MAX_BACKS = 8;

/** 全曲リストの譜面の列名の組を、難易度名(`sp_black`の形)の組にする */
const chartMovesOf = (moves: Partial<Record<Chart, Chart>>) =>
  Object.fromEntries(
    Object.entries(moves).map(([to, from]) =>
      difficultyNamesOf([to as Chart, from as Chart])
    ),
  );

const isFiveKeys = ({ row }: GroupRow) => row.front?.fiveKeys === true;

/**
 * 同じ表の曲の裏は、古い世代から順に番号を振り、us は最後にする。
 * `owner`は組のセーブの枠の持ち主で、裏になったら印を付ける
 */
function variantsTo(
  catalogs: readonly GenerationCatalog[],
  front: GroupRow,
  backs: readonly GroupRow[],
  owner?: GroupRow,
): CatalogVariant[] {
  const last = catalogs.length;
  const order = (generation: string) =>
    generation === "us" ? last : orderOf(catalogs, generation);
  const sorted = backs.toSorted((a, b) =>
    order(a.generation) - order(b.generation)
  );
  const chosen = sorted.filter(({ row }) => row.front?.rule === undefined);
  const frontTitle = titleOf(front.row);
  if (chosen.length > MAX_BACKS) {
    throw new Error(
      `${front.generation}/${frontTitle}の裏は${MAX_BACKS}曲までにする`,
    );
  }
  return sorted.map((back) => {
    const { generation, row } = back;
    const { chartMoves, rule } = row.front ?? {};
    return {
      ...(chartMoves === undefined
        ? {}
        : { chartMoves: chartMovesOf(chartMoves) }),
      frontGeneration: front.generation,
      frontLine: front.row.line,
      frontTitle,
      generation,
      line: row.line,
      ...(rule === undefined ? { position: chosen.indexOf(back) } : { rule }),
      ...(back === owner ? { slotOwner: true as const } : {}),
      title: titleOf(row),
    };
  });
}

/**
 * `catalogs`は全曲リストのファイルの順に並べる。
 * 組が原作の5鍵盤版を持つなら、`five_keys`の行はその5鍵盤版の裏になる
 */
export function catalogVariantsOf(
  catalogs: readonly GenerationCatalog[],
  keyOf: SongKeyOf,
  isTwin: IsFiveKeyTwin,
  chooseFront: FrontChooser = ownerAsFront,
): CatalogVariant[] {
  return catalogGroupsOf(catalogs, keyOf, isTwin, chooseFront).flatMap((
    { front, others, owner, twin },
  ) => [
    ...variantsTo(
      catalogs,
      front,
      others.filter((r) => !isFiveKeys(r)),
      owner,
    ),
    ...(twin === undefined
      ? []
      : variantsTo(catalogs, twin, others.filter(isFiveKeys))),
  ]);
}

/** 原作の5鍵盤版を持たない組で、`front_rule`に`five_keys`と書いた行を、表の5鍵盤版にする */
export function catalogFiveKeysOf(
  catalogs: readonly GenerationCatalog[],
  keyOf: SongKeyOf,
  isTwin: IsFiveKeyTwin,
  chooseFront: FrontChooser = ownerAsFront,
): CatalogFiveKey[] {
  return catalogGroupsOf(catalogs, keyOf, isTwin, chooseFront).flatMap(
    ({ front, others, twin }) => {
      const fiveKeys = twin === undefined ? others.filter(isFiveKeys) : [];
      if (fiveKeys.length > 1) {
        throw new Error(
          `${front.generation}/${titleOf(front.row)}の5鍵盤版が2行ある`,
        );
      }
      // 表の5鍵盤版は自分の譜面だけを出すので、ほかの難易度へ移せない
      const charted = fiveKeys.find(({ row }) => row.front?.chartMoves);
      if (charted !== undefined) {
        throw new Error(
          `${charted.generation}の全曲リスト line ${charted.row.line}: ` +
            "原作の5鍵盤版が無い組の5鍵盤版に、chart_movesを書いている",
        );
      }
      return fiveKeys.map(({ generation, row }) => ({
        frontGeneration: front.generation,
        frontTitle: titleOf(front.row),
        generation,
        line: row.line,
        title: titleOf(row),
      }));
    },
  );
}
