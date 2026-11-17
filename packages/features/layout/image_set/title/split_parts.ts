// 画像セットは、ローダーの上限に合わせて複数のファイルへ分ける。
// このファイルは、分けた先のDATA1 indexと、曲のsprite参照の向け直しを割り当てる。

import type { ImageSetKind, TitleSpriteRef } from "@csa/core";

export interface PartsInput {
  kind: ImageSetKind;
  /** 1本目が置き換えるPBのDATA1 index */
  pbIndex: number;
  /** 2本目以降に充てる最初のDATA1 index */
  nextExtraIndex: number;
  /** 報告に添える、足したspriteの内訳 */
  summaries: readonly string[];
  /** 分割前のsprite番号 → 分割後のファイル番号とsprite番号 */
  spriteMap: ReadonlyMap<number, { part: number; sprite: number }>;
  /** 分けたファイルの数 */
  partCount: number;
}

export interface PartsPlan {
  /** 分けたファイルの並びに対応する割り当て */
  files: { data1Index: number; summary: string }[];
  /** 次の画像セットが使う、空いている最初のDATA1 index */
  nextExtraIndex: number;
}

/** 分けたファイルへDATA1 indexを割り当て、`songSprites`の項目のうち、`pbIndex`を参照する項目の参照先を書き換える */
export function assignParts(
  input: PartsInput,
  songSprites: Map<number, TitleSpriteRef[]>,
): PartsPlan {
  const { kind, pbIndex } = input;
  let nextExtraIndex = input.nextExtraIndex;
  const partIndices = Array.from(
    { length: input.partCount },
    (_, part) => part === 0 ? pbIndex : nextExtraIndex++,
  );
  const files = partIndices.map((data1Index, part) => ({
    data1Index,
    summary: part === 0
      ? `${kind}[${pbIndex}] ${input.summaries.join(" / ")}`
      : `${kind}[${data1Index}] ${pbIndex}の分割${part}`,
  }));
  for (const refs of songSprites.values()) {
    refs.forEach((ref, slot) => {
      if (ref.fileIndex !== pbIndex) {
        return;
      }
      const moved = input.spriteMap.get(ref.sprite);
      if (moved === undefined) {
        throw new Error(`${kind} sprite ${ref.sprite}が分割後に無い`);
      }
      refs[slot] = {
        fileIndex: partIndices[moved.part],
        sprite: moved.sprite,
      };
    });
  }
  return { files, nextExtraIndex };
}
