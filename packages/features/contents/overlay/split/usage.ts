// 場面(曲DBの組が参照するanimation)から辿れるanimation・sprite・sheetを集める。
// 分ける単位はsheetなので、場面ごとのsheet集合が分け方を決める入力になる。

import type { Animation, IfPackage } from "@csa/core";

/** spriteのyはsheetを縦に1024間隔で積んだ座標で、上位がsheet番号 */
export const sheetOfSpriteY = (y: number): number => y >> 10;

/** sheet内の行。新しいsheet番号と組み直してyを作る */
export const rowOfSpriteY = (y: number): number => y & 0x3ff;

export interface SceneUsage {
  /** 場面自身と、種類2で辿った先 */
  animations: Set<number>;
  sheets: Set<number>;
  sprites: Set<number>;
}

/**
 * 種類0と1はsprite、2は同じ表のanimation、3は外部委譲で何も描かない。
 */
export function sceneUsage(
  pkg: IfPackage,
  animations: readonly Animation[],
  scenes: Iterable<number>,
): SceneUsage {
  const reached = new Set<number>();
  const sprites = new Set<number>();
  const walk = (index: number) => {
    if (reached.has(index)) return;
    const animation = animations[index];
    if (animation === undefined) {
      throw new Error(`animation ${index} が表に無い`);
    }
    reached.add(index);
    for (const item of animation.items) {
      if (item.kind === 3) continue;
      if (item.kind === 2) walk(item.target);
      else sprites.add(item.target);
    }
  };
  for (const scene of scenes) walk(scene);
  const sheets = new Set<number>();
  for (const sprite of sprites) {
    const rect = pkg.metadata.sprites[sprite];
    if (rect === undefined) throw new Error(`sprite ${sprite} が表に無い`);
    sheets.add(sheetOfSpriteY(rect.y));
  }
  return { animations: reached, sheets, sprites };
}

/** 場面ごとに使うsheetの集合。場面はanimation番号の昇順に並べる */
export function sceneSheets(
  pkg: IfPackage,
  animations: readonly Animation[],
  scenes: Iterable<number>,
): { animation: number; sheets: ReadonlySet<number> }[] {
  return [...scenes].sort((a, b) => a - b).map((animation) => ({
    animation,
    sheets: sceneUsage(pkg, animations, [animation]).sheets,
  }));
}
