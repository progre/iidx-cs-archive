// legacy(3rd〜8th)の4表から、animation・組・spriteの項目を読む。
// 表の位置は tables.ts が割り出す。

import { FRAME_STRIDE, SPRITE_STRIDE, type Tables } from "./tables.ts";

/**
 * sprite の +0xd。描画構造体の先頭へ22bit左詰めで入る。
 * このビットが立つと、原盤の描画処理は UV を逆順に読む
 */
export const FLIP_VERTICAL = 1;
export const FLIP_HORIZONTAL = 2;

export interface Sprite {
  /** 反転の印(FLIP_*)。bit2 はtileの引き方の選択で、tileの画素を直接読む CSA には関係しない */
  flag: number;
  h: number;
  /** CLUTの枚と16色ぶんの位置。枚は`set`の中で数える */
  selector: number;
  /** パレット組。CLUTの位置表`0x22aa00`の行を選ぶ */
  set: number;
  tile: number;
  /** tileの中の切り出し位置 */
  u: number;
  v: number;
  w: number;
  /** 画面上の位置。左から右へ並ぶ */
  x: number;
  y: number;
}

export function spriteAt(
  elf: Uint8Array,
  tables: Tables,
  index: number,
): Sprite {
  const view = new DataView(elf.buffer, elf.byteOffset, elf.byteLength);
  const at = tables.sprites + index * SPRITE_STRIDE;
  return {
    flag: elf[at + 0xd],
    h: view.getUint16(at + 6, true),
    selector: elf[at + 0xc],
    set: view.getUint16(at + 0xe, true),
    tile: view.getUint16(at + 8, true),
    u: elf[at + 0xa],
    v: elf[at + 0xb],
    w: view.getUint16(at + 4, true),
    x: view.getInt16(at, true),
    y: view.getInt16(at + 2, true),
  };
}

/** 小片の(x, y)が読むtileの位置。反転の印が立つ向きは端から逆に読む */
export function sourceOf(
  sprite: Sprite,
  x: number,
  y: number,
): [number, number] {
  return [
    sprite.u + ((sprite.flag & FLIP_HORIZONTAL) !== 0 ? sprite.w - 1 - x : x),
    sprite.v + ((sprite.flag & FLIP_VERTICAL) !== 0 ? sprite.h - 1 - y : y),
  ];
}

/** animationが並べる組のindexを、frame表の順に返す */
export function groupsOfAnimation(
  elf: Uint8Array,
  tables: Tables,
  animation: number,
): number[] {
  const view = new DataView(elf.buffer, elf.byteOffset, elf.byteLength);
  const u16 = (at: number) => view.getUint16(at, true);
  const start = u16(tables.animations + animation * 4);
  const count = u16(tables.animations + animation * 4 + 2);
  return Array.from(
    { length: count },
    (_, i) => u16(tables.frames + (start + i) * FRAME_STRIDE),
  );
}

/** 組が並べるspriteを返す */
export function spritesOfGroup(
  elf: Uint8Array,
  tables: Tables,
  group: number,
): Sprite[] {
  const view = new DataView(elf.buffer, elf.byteOffset, elf.byteLength);
  const start = view.getUint16(tables.groups + group * 4, true);
  const count = view.getUint16(tables.groups + group * 4 + 2, true);
  return Array.from(
    { length: count },
    (_, i) => spriteAt(elf, tables, start + i),
  );
}

/** animationの先頭の組が並べるspriteを返す */
export function spritesOfAnimation(
  elf: Uint8Array,
  tables: Tables,
  animation: number,
): Sprite[] {
  const groups = groupsOfAnimation(elf, tables, animation);
  const first = groups.at(0);
  return first === undefined ? [] : spritesOfGroup(elf, tables, first);
}
