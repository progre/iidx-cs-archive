// legacyの1世代ぶんの表示資産を開き、曲DBの欄から絵を焼くところまでを受け持つ。
// 表の割り出しは tables.ts、色はspriteが持つパレット組から取る。

import type { Image } from "@csa/core";
import { colorsOf, findPalettes, paletteSet, toRgba } from "./palette.ts";
import {
  groupsOfAnimation,
  sourceOf,
  type Sprite,
  spritesOfGroup,
} from "./sprite.ts";
import { BIAS, findTables } from "./tables.ts";
import { findEmbedded, IFS_ITEMS, SIDE, tileIndices } from "./tile.ts";

export interface Generation {
  /** 曲DBの項目数。実曲でない項目も含む */
  count: number;
  /** 曲名カード欄が指すanimationの、最初の組を焼いた絵 */
  cardOf(id: number): Image | null;
  /** 曲名カード欄がカードを指していれば真。絵は焼かない */
  hasCard(id: number): boolean;
  /** animationを直に指定して焼く */
  imageOf(animation: number): Image | null;
  titleOf(id: number): string;
}

/** 曲DBから呼び出し側が取り出す欄。曲DBの読み方はこの世代の外にある */
export interface GenerationSongs {
  /** 曲DBの項目数 */
  count: number;
  /** 曲名カード欄の値 */
  titleCardOf(id: number): number;
  /** 曲の並び。曲DBの項目番号で引く */
  titles: readonly { title: string }[];
}

/** 曲DBとsongmapの曲の並びから、世代の表示資産を開く */
export const openLegacyGenerationOf = (
  gen: string,
  elf: Uint8Array,
  db: {
    readonly length: number;
    record(id: number): { artwork: { titleCard: number } };
  },
  titles: GenerationSongs["titles"],
): Generation =>
  openLegacyGeneration(gen, elf, {
    count: db.length,
    titleCardOf: (id) => db.record(id).artwork.titleCard,
    titles,
  });

/** 素材ELFは呼び出し側が持つ。配置器はmanifestが指すELFを渡す */
export function openLegacyGeneration(
  gen: string,
  elf: Uint8Array,
  songs: GenerationSongs,
): Generation {
  const bias = BIAS[gen];
  const tables = findTables(elf, bias);
  if (tables === null) throw new Error(gen + "の表が見つからない");
  const embedded = findEmbedded(elf, bias, IFS_ITEMS[gen]);
  if (embedded === null) throw new Error(gen + "の埋め込みtileが見つからない");
  const palettes = findPalettes(elf, bias);
  if (palettes === null) throw new Error(gen + "のパレット表が見つからない");

  const tiles = new Map<number, Uint8Array | null>();
  const indicesOf = (tile: number) => {
    if (!tiles.has(tile)) {
      tiles.set(
        tile,
        tileIndices(elf, bias, embedded, tile)?.indices ?? null,
      );
    }
    return tiles.get(tile) ?? null;
  };
  const sets = new Map<number, Uint16Array | null>();
  const setOf = (set: number) => {
    if (!sets.has(set)) sets.set(set, paletteSet(elf, bias, palettes, set));
    return sets.get(set) ?? null;
  };

  /** spriteをそれぞれが持つパレット組で1枚に焼く */
  function render(sprites: Sprite[]): Image {
    const left = Math.min(...sprites.map((s) => s.x));
    const top = Math.min(...sprites.map((s) => s.y));
    const width = Math.max(...sprites.map((s) => s.x + s.w)) - left;
    const height = Math.max(...sprites.map((s) => s.y + s.h)) - top;
    const rgba = new Uint8Array(width * height * 4);
    for (const sprite of sprites) {
      const indices = indicesOf(sprite.tile);
      const colors = setOf(sprite.set);
      if (indices === null || colors === null) continue;
      const palette = colorsOf(colors, sprite.selector);
      for (let y = 0; y < sprite.h; y++) {
        for (let x = 0; x < sprite.w; x++) {
          const [sx, sy] = sourceOf(sprite, x, y);
          if (sx >= SIDE || sy >= SIDE) continue;
          // index 0 は読み込み時に差し替えられる透過色
          const index = indices[sy * SIDE + sx];
          if (index === 0) continue;
          const value = toRgba(palette[index] ?? 0);
          if (value[3] === 0) continue;
          rgba.set(
            value,
            ((sprite.y - top + y) * width + sprite.x - left + x) * 4,
          );
        }
      }
    }
    return { height, rgba, width };
  }

  const spritesOfAnimation = (animation: number): Sprite[] | null => {
    if (animation < 1 || animation >= tables.animationCount) return null;
    const group = groupsOfAnimation(elf, tables, animation).at(0);
    if (group === undefined) return null;
    const sprites = spritesOfGroup(elf, tables, group);
    return sprites.length === 0 ? null : sprites;
  };
  const imageOf = (animation: number): Image | null => {
    const sprites = spritesOfAnimation(animation);
    return sprites === null ? null : render(sprites);
  };

  return {
    count: songs.count,
    cardOf: (id) => imageOf(songs.titleCardOf(id)),
    hasCard: (id) => spritesOfAnimation(songs.titleCardOf(id)) !== null,
    imageOf,
    titleOf: (id) => songs.titles.at(id)?.title ?? String(id),
  };
}
