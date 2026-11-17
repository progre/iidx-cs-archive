// 枠が並べる小片を、frameごとに合成してから切り直し(compose.ts)、重複を除いて絵の列にする。
// シートへの詰めはcontainers側が受け持つ。

import type { Image } from "@csa/core";
import {
  bakeSprite,
  BIAS,
  composeFrame,
  cutSprite,
  findEmbedded,
  findPalettes,
  IFS_ITEMS,
  type IfsTile,
  imageKey,
  paletteSet,
  sameImage,
  type SetOf,
  tileIndices,
  type TileOf,
} from "../legacy/mod.ts";
import type { OverlayFrame, OverlaySlot } from "./slots.ts";

/**
 * tileの引き先を世代ごとに作る。`IFs`に無い番号はELFの埋め込みから引く
 * 6thの44曲は埋め込みだけを使う。
 */
export function tileResolver(
  generation: string,
  elf: Uint8Array,
): (ifs: TileOf | null) => TileOf {
  const bias = BIAS[generation];
  const embedded = findEmbedded(elf, bias, IFS_ITEMS[generation]);
  if (embedded === null) {
    throw new Error(`${generation}の埋め込みtileが見つからない`);
  }
  const cache = new Map<number, IfsTile | null>();
  const fromElf = (serial: number) => {
    if (!cache.has(serial)) {
      cache.set(serial, tileIndices(elf, bias, embedded, serial));
    }
    return cache.get(serial) ?? null;
  };
  return (ifs) => (serial) => ifs?.(serial) ?? fromElf(serial);
}

export interface BakedImages {
  /** 見た目が同じ絵は1件 */
  images: Image[];
  /** frameの小片ごとの、`images`の添字 */
  placed: Map<OverlayFrame, number[]>;
  /** 小片の四方に含めた隣の画素の幅。置き場所はこのぶん戻す */
  skirt: number;
}

/** 見た目が同じ絵を1件にまとめて番号を振る */
class ImageIndex {
  readonly images: Image[] = [];
  readonly #order = new Map<string, number[]>();

  indexOf(image: Image): number {
    const key = imageKey(image);
    const candidates = this.#order.get(key) ?? [];
    const found = candidates.find((i) => sameImage(this.images[i], image));
    if (found !== undefined) return found;
    const index = this.images.length;
    this.images.push(image);
    this.#order.set(key, [...candidates, index]);
    return index;
  }
}

export function bakeImages(
  generation: string,
  elf: Uint8Array,
  tileOf: TileOf,
  slots: readonly OverlaySlot[],
  skirt: number,
): BakedImages {
  const bias = BIAS[generation];
  const palettes = findPalettes(elf, bias);
  if (palettes === null) {
    throw new Error(`${generation}のパレット表が見つからない`);
  }
  const sets = new Map<number, Uint16Array | null>();
  const setOf: SetOf = (set) => {
    if (!sets.has(set)) sets.set(set, paletteSet(elf, bias, palettes, set));
    return sets.get(set) ?? null;
  };
  const index = new ImageIndex();
  const placed = new Map<OverlayFrame, number[]>();
  for (const slot of slots) {
    for (const frame of slot.frames) {
      const composed = composeFrame(tileOf, setOf, frame.sprites, skirt);
      placed.set(
        frame,
        frame.sprites.map((sprite) =>
          index.indexOf(
            cutSprite(
              composed,
              bakeSprite(tileOf, setOf, sprite),
              sprite,
              skirt,
            ),
          )
        ),
      );
    }
  }
  return { images: index.images, placed, skirt };
}
