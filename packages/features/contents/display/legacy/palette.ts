// legacy(3rd〜8th)のパレット。曲DBのパレット欄が組を選び、組は圧縮された
// 16枚×256色(GSのPSMCT16)である。spriteの`selector`の上位4bitが枚、
// 下位4bitが16色ぶんの位置を選ぶ。

import { decompress } from "./tile.ts";

/** 1枚の色数。4bppのtileは先頭から16色ずつを使う */
const COLORS = 256;
const SHEET = COLORS * 2;

export interface PaletteTable {
  at: number;
  count: number;
}

const MIN_RUN = 40;
const MIN_STEP = 0x40;
const MAX_STEP = 0x4000;

/**
 * パレットの表を探す。パレットは順に置かれるので、ポインタが少しずつ増える並びを
 * 拾い、展開して1枚ぶん(`0x200`)の倍数になるものを採る。
 */
export function findPalettes(
  elf: Uint8Array,
  bias: number,
): PaletteTable | null {
  const view = new DataView(elf.buffer, elf.byteOffset, elf.byteLength);
  const target = (at: number) => view.getUint32(at, true) - bias;

  /** 並びの何点かを展開してみて、1枚ぶんの倍数になるかを見る */
  const looksLikePalettes = (start: number) =>
    "0 1 2".split(" ").map(Number).every((i) => {
      const raw = decompress(elf, target(start + i * 4));
      return raw.length >= SHEET && raw.length % SHEET === 0;
    });

  let best: PaletteTable | null = null;
  let start = -1;
  let count = 0;
  const consider = () => {
    if (count < MIN_RUN || (best !== null && count + 1 <= best.count)) return;
    if (looksLikePalettes(start)) best = { at: start, count: count + 1 };
  };
  for (let at = 0; at + 8 <= elf.length; at += 4) {
    const here = target(at);
    const step = target(at + 4) - here;
    if (
      here > 0 && here + 16 < elf.length && step > MIN_STEP && step < MAX_STEP
    ) {
      if (start < 0) start = at;
      count++;
      continue;
    }
    consider();
    start = -1;
    count = 0;
  }
  consider();
  return best;
}

/** 組を展開して、色をPSMCT16のまま返す */
export function paletteSet(
  elf: Uint8Array,
  bias: number,
  table: PaletteTable,
  set: number,
): Uint16Array | null {
  if (set < 0 || set >= table.count) return null;
  const view = new DataView(elf.buffer, elf.byteOffset, elf.byteLength);
  const raw = decompress(elf, view.getUint32(table.at + set * 4, true) - bias);
  return new Uint16Array(
    raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.length & ~1),
  );
}

/** PSMCT16をRGBAへ。bit15がalpha、5bitずつのR・G・B */
export function toRgba(color: number): number[] {
  const level = (value: number) => (value << 3) | (value >> 2);
  return [
    level(color & 0x1f),
    level((color >> 5) & 0x1f),
    level((color >> 10) & 0x1f),
    (color & 0x8000) === 0 ? 0 : 255,
  ];
}

/** spriteの`selector`が指す16色を返す */
export function colorsOf(
  set: Uint16Array,
  selector: number,
): Uint16Array {
  const at = (selector >> 4) * COLORS + (selector & 0xf) * 16;
  return set.slice(at, at + 16);
}

/**
 * tileの画素が引く色。8bppのtile(種別1)は`selector`の上位4bitが選ぶ256色を使う
 */
export function colorsOfTile(
  set: Uint16Array,
  selector: number,
  tileKind: number,
): Uint16Array {
  if (tileKind !== 1) {
    return colorsOf(set, selector);
  }
  const sheet = selector >> 4;
  return set.subarray(sheet * COLORS, (sheet + 1) * COLORS);
}
