// 8th以前の曲DBの5枠から、animation・group・spriteを辿る。
// 表とパレットの割り出しは世代ごとに1回だけ行う。

import {
  BIAS,
  type Embedded,
  findEmbedded,
  findPalettes,
  findTables,
  groupsOfAnimation,
  IFS_ITEMS,
  paletteSet,
  type PaletteTable,
  type Sprite,
  spritesOfGroup,
  type Tables,
  tileIndices,
  type TileOf,
} from "@csa/contents-display";
import type { SongDbRecord } from "@csa/contents-song-db";

export class LegacyTables {
  readonly #sets = new Map<number, Uint16Array | null>();

  private constructor(
    private readonly elf: Uint8Array,
    private readonly bias: number,
    private readonly tables: Tables,
    private readonly palettes: PaletteTable,
    private readonly embedded: Embedded,
  ) {}

  /** 3rd〜8th以外はnull */
  static open(generation: string, elf: Uint8Array): LegacyTables | null {
    const bias = BIAS[generation];
    if (bias == null) {
      return null;
    }
    const tables = findTables(elf, bias);
    const palettes = findPalettes(elf, bias);
    if (tables == null || palettes == null) {
      throw new Error(`${generation}の表かパレット表が見つからない`);
    }
    const embedded = findEmbedded(elf, bias, IFS_ITEMS[generation]);
    if (embedded == null) {
      throw new Error(`${generation}の埋め込みtileが見つからない`);
    }
    return new LegacyTables(elf, bias, tables, palettes, embedded);
  }

  /** ELFに埋め込まれたtileを通し番号で引く。埋め込みの範囲外の番号はnull */
  embeddedTileOf: TileOf = (serial) => {
    const { elf, bias, embedded } = this;
    return tileIndices(elf, bias, embedded, serial);
  };

  /** パレットの組。16枚×256色のPSMCT16 */
  setOf(set: number): Uint16Array | null {
    if (!this.#sets.has(set)) {
      this.#sets.set(set, paletteSet(this.elf, this.bias, this.palettes, set));
    }
    return this.#sets.get(set) ?? null;
  }

  /**
   * 曲の枠が指すanimationの、全frameのsprite。
   * 種別が0の枠と、範囲外のanimationを指す枠は除く
   */
  spritesOf(record: SongDbRecord): Sprite[] {
    const { elf, tables } = this;
    return (record.overlay.slots ?? [])
      .filter((values) => values.at(0) !== 0)
      .map((values) => values.at(1) ?? 0)
      .filter((animation) =>
        animation >= 1 && animation < tables.animationCount
      )
      .flatMap((animation) => groupsOfAnimation(elf, tables, animation))
      .flatMap((group) => spritesOfGroup(elf, tables, group));
  }
}
