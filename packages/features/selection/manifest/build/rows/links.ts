// 選んだ曲へ曲indexを割り当て、5鍵盤版と裏エントリーを表の曲の枠で結ぶ。
// 曲DBの曲indexは、世代ごとのsong_idでなく、PBの枠で表す。

import type { ManifestSongDraft } from "@csa/core";
import { fiveKeyKey, type Selection, songKey } from "./select.ts";

/** 表の曲の行。同じ曲を2行に書いた曲は2行とも表になることがあるので、曲番号と行番号で見分ける */
const frontLineKey = (
  generation: string,
  songId: number,
  line: number | undefined,
): string => `${generation}/${songId}@${line}`;

/** 表の曲。世代を書いていなければ、裏と同じ世代の曲である */
const variantKey = (row: ManifestSongDraft): string =>
  frontLineKey(
    row.variantOf?.generation ?? row.sourceGeneration,
    row.variantOf?.songId ?? -1,
    row.variantOf?.frontLine,
  );

/** PB原盤の曲は、固定枠のsong_idの位置にある */
const isPbFront = (row: ManifestSongDraft) =>
  row.variantOf?.generation === "pb";

/**
 * 曲indexを割り当て、組の相手の曲indexも埋める。
 * 選曲リストに出る曲は、PB の枠を使う表の曲(`pbSlot`)ならその枠に、ほかは`slotOf`が返す組の曲indexに置く。
 * `slotOf`は全曲リストから決まるので、原盤が欠けた曲の曲indexは空いたまま残る。
 * 裏エントリーは`targetSongCount`から割り当てる。
 * 差し替え元の表が選ばれていない裏エントリーは、原作でも指されないので載せない。
 */
export function plannedSongs(
  selection: Pick<Selection, "selected" | "variants">,
  targetSongCount: number,
  slotOf: (row: ManifestSongDraft) => number | undefined,
): ManifestSongDraft[] {
  const { selected, variants } = selection;
  const indexOf = (row: ManifestSongDraft): number => {
    const index = row.pbSlot ?? slotOf(row);
    if (index === undefined) {
      throw new Error(
        `${songKey(row)}@${row.catalogLine}の曲indexが全曲リストで決まらない`,
      );
    }
    return index;
  };
  const frontIndexOf = new Map(
    selected.map((row) => [songKey(row), indexOf(row)]),
  );
  const frontLineIndexOf = new Map(
    selected.map((row) => [
      frontLineKey(row.sourceGeneration, row.sourceSongIndex, row.catalogLine),
      indexOf(row),
    ]),
  );
  // 条件に使う曲が選外なら、その条件は働かない
  const withVariant = (row: ManifestSongDraft): ManifestSongDraft => {
    const variant = row.variantOf;
    if (variant === undefined) {
      return row;
    }
    const after = variant.afterSongId === undefined
      ? undefined
      : frontIndexOf.get(row.sourceGeneration + "/" + variant.afterSongId);
    return {
      ...row,
      variantOf: {
        ...variant,
        ...(after === undefined ? {} : { afterTargetSongIndex: after }),
        targetSongIndex: isPbFront(row)
          ? variant.songId
          : frontLineIndexOf.get(variantKey(row)) as number,
      },
    };
  };
  const withFiveKey = (row: ManifestSongDraft): ManifestSongDraft =>
    row.fiveKeyOf === undefined ? row : {
      ...row,
      fiveKeyOf: {
        ...row.fiveKeyOf,
        targetSongIndex: row.fiveKeyOf.generation === "pb"
          ? row.fiveKeyOf.songId
          : frontIndexOf.get(fiveKeyKey(row)) as number,
      },
    };
  return [
    ...selected.map((row) => ({
      ...withFiveKey(row),
      targetSongIndex: indexOf(row),
    })),
    ...variants.filter((row) =>
      isPbFront(row) || frontLineIndexOf.has(variantKey(row))
    ).map((row, index) => ({
      ...withVariant(row),
      targetSongIndex: targetSongCount + index,
    })),
  ];
}
