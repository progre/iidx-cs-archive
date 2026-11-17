// 曲名spriteをPBの共有画像セット4本へ足すとき、どのspriteを足し、曲のsprite参照をどこへ向けるかを決める。
// 素材世代が複数あるときは、PBの画像セットへ世代の順に積み重ねる。

import type { ImageSetKind, TitleSpriteRef } from "@csa/core";

/** 用途順は、曲リストの曲名、大きな曲名、ジャンル、アーティストである */
export const PB_IMAGE_SETS: { kind: ImageSetKind; pb: number }[] = [
  { kind: "small", pb: 1312 },
  { kind: "big", pb: 1313 },
  { kind: "genre", pb: 1314 },
  { kind: "artist", pb: 1315 },
];

/** 曲DB`+0xAC`からの欄の並びは、ジャンル、大、アーティスト、小である */
export const PB_SLOT_OF: Record<ImageSetKind, number> = {
  artist: 2,
  big: 1,
  genre: 0,
  small: 3,
};

/** この世代は文字の元の色を残す。PB原盤の文字も元の色のままで、ほかの世代の文字はシルバーにそろえる */
const COLORED_GENERATION = "emp";

/** 写すspriteの文字をそろえるシルバーの手本を選ぶ。元の色を残す世代にはnullを返す */
export function silverFor(
  generation: string,
  reference: number[],
): number[] | null {
  return generation === COLORED_GENERATION ? null : reference;
}

/** 1つの世代から、1つの共有画像セットへ足すspriteの範囲 */
export interface CopyScope {
  /** 全曲リストの絵で埋める枠。その枠の曲は、素材からspriteを写さない */
  drawn: ReadonlyMap<number, ReadonlySet<ImageSetKind>>;
  generation: string;
  generationOf: ReadonlyMap<number, string>;
  kind: ImageSetKind;
  /** 素材側の共有画像セットのDATA1 index */
  sourceIndex: number;
  sourceRefs: ReadonlyMap<number, TitleSpriteRef[]>;
}

const isCopied = (scope: CopyScope, song: number): boolean =>
  scope.generationOf.get(song) === scope.generation &&
  !(scope.drawn.get(song)?.has(scope.kind) ?? false);

/** 素材の画像セットから写すsprite番号を選ぶ。写すspriteが無ければundefinedを返す */
export function neededSprites(scope: CopyScope): number[] | undefined {
  const needed = [...scope.sourceRefs]
    .filter(([song]) => isCopied(scope, song))
    .flatMap(([, refs]) => refs)
    .filter((ref) => ref.fileIndex === scope.sourceIndex)
    .map((ref) => ref.sprite);
  return needed.length === 0 ? undefined : needed;
}

/** 素材から写した曲のsprite参照を、PBの画像セットの新しいspriteへ向ける */
export function pointToCopied(
  songSprites: Map<number, TitleSpriteRef[]>,
  scope: CopyScope,
  pbIndex: number,
  spriteMap: ReadonlyMap<number, number>,
): void {
  for (const [song, refs] of scope.sourceRefs) {
    if (!isCopied(scope, song)) {
      continue;
    }
    refs.forEach((ref, slot) => {
      if (ref.fileIndex !== scope.sourceIndex) {
        return;
      }
      const sprite = spriteMap.get(ref.sprite);
      if (sprite === undefined) {
        throw new Error(
          `song${song} の${scope.kind} spriteが割り当てられていない`,
        );
      }
      songSprites.get(song)![slot] = { fileIndex: pbIndex, sprite };
    });
  }
}

/** 全曲リストの絵を指す曲のsprite参照を、PBの画像セットの新しいspriteへ向ける */
export function pointToDrawn(
  songSprites: Map<number, TitleSpriteRef[]>,
  kind: ImageSetKind,
  pbIndex: number,
  drawn: readonly { targets: readonly number[] }[],
  spriteIndices: readonly number[],
): void {
  drawn.forEach((entry, i) => {
    for (const target of entry.targets) {
      songSprites.get(target)![PB_SLOT_OF[kind]] = {
        fileIndex: pbIndex,
        sprite: spriteIndices[i],
      };
    }
  });
}

/** 置き換えられていない参照が残った曲があれば、例外にする */
export function assertAllReplaced(
  songSprites: ReadonlyMap<number, TitleSpriteRef[]>,
): void {
  for (const [song, refs] of songSprites) {
    if (refs.some((ref) => ref.sprite < 0)) {
      throw new Error(`song${song} に置き換えられていない画像セット欄がある`);
    }
  }
}
