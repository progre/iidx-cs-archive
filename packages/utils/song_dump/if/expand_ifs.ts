// 8th以前の曲中オーバーレイの`IFs`のtileを、色の組み合わせごとに1枚のPNGへ並べる。
// tileは色を持たないので、曲のspriteが指すパレットの組と選択子で塗る。
// 並びは通し番号順で、COLUMNS枚で折り返す。
// どのspriteにも使われないtileは扱わない。ELFに埋め込まれたtileは`embedded_tiles.ts`が書く。

import {
  colorsOfTile,
  type IfsTile,
  openIfs,
  SIDE,
  type Sprite,
  type TileOf,
  toRgba,
} from "@csa/contents-display";
import type { SongDbRecord } from "@csa/contents-song-db";
import type { LegacyTables } from "./legacy_tables.ts";
import { type Rgba, writePng } from "./if_files.ts";

const COLUMNS = 8;

/** 同じ組と選択子で塗るtileの通し番号 */
export interface Combo {
  selector: number;
  set: number;
  tiles: number[];
}

export function combosOf(sprites: Sprite[], hasTile: (n: number) => boolean) {
  const combos = new Map<string, Combo>();
  sprites
    .filter((sprite) => hasTile(sprite.tile))
    .forEach(({ selector, set, tile }) => {
      const key = `${set}_${selector}`;
      const combo = combos.get(key) ?? { selector, set, tiles: [] };
      combo.tiles.push(tile);
      combos.set(key, combo);
    });
  return [...combos.values()].map((combo) => ({
    ...combo,
    tiles: [...new Set(combo.tiles)].sort((a, b) => a - b),
  }));
}

/** index 0と、色のalphaが0の画素は透過 */
function paintTile(
  image: Rgba,
  at: number,
  tile: IfsTile,
  colors: Uint16Array,
) {
  const left = (at % COLUMNS) * SIDE;
  const top = Math.floor(at / COLUMNS) * SIDE;
  tile.indices.forEach((index, i) => {
    if (index === 0) {
      return;
    }
    const x = left + (i % SIDE);
    const y = top + Math.floor(i / SIDE);
    image.rgba.set(toRgba(colors[index] ?? 0), (y * image.width + x) * 4);
  });
}

function paintCombo(
  combo: Combo,
  set: Uint16Array,
  tileOf: TileOf,
) {
  const count = combo.tiles.length;
  const width = Math.min(count, COLUMNS) * SIDE;
  const height = Math.ceil(count / COLUMNS) * SIDE;
  const image = { height, rgba: new Uint8Array(width * height * 4), width };
  combo.tiles.forEach((serial, at) => {
    const tile = tileOf(serial);
    if (tile == null) {
      return;
    }
    paintTile(image, at, tile, colorsOfTile(set, combo.selector, tile.kind));
  });
  return image;
}

/** 組み合わせごとに`tile_<組>_<選択子>.png`を書く */
export async function writeCombos(
  dir: string,
  combos: Combo[],
  legacy: LegacyTables,
  tileOf: TileOf,
) {
  for (const combo of combos) {
    const set = legacy.setOf(combo.set);
    if (set == null) {
      continue;
    }
    const name = `tile_${combo.set}_${combo.selector}`;
    await writePng(dir, name, paintCombo(combo, set, tileOf));
  }
}

export async function expandIfs(
  dir: string,
  bytes: Uint8Array,
  legacy: LegacyTables,
  record: SongDbRecord,
) {
  const tileOf = openIfs(bytes);
  const combos = combosOf(legacy.spritesOf(record), (n) => tileOf(n) != null);
  await Deno.mkdir(dir, { recursive: true });
  await writeCombos(dir, combos, legacy, tileOf);
}
