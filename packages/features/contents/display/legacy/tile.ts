// legacy(3rd〜8th)のtileの画素を取り出す。
// tileは128x128で、種別0が4bpp、種別1が8bpp。番号が小さいものは`IFs`の項目、
// 大きいものはELFに埋め込まれた{u32 種別, 圧縮データ}である。

export const SIDE = 128;

/**
 * 原盤の`IFs`コンテナが持つ項目数。tile番号はこれ未満が`IFs`の項目、
 * これ以上がELF埋め込みで、埋め込みのポインタ表はこの番号から始まる。
 * 値は、`IFs`のヘッダにある通し番号を、原盤ごとに数えて求めた。
 */
export const IFS_ITEMS: Record<string, number> = {
  "3rd": 2926,
  "4th": 655,
  "5th": 1709,
  "6th": 1455,
  "7th": 3036,
  "8th": 1443,
};

/** ELFの描画処理と同じ展開。制御bitが1のとき先頭バイトで3種に分かれる */
export function decompress(input: Uint8Array, from: number): Uint8Array {
  const out: number[] = [];
  let at = from;
  let control = 0;
  const copy = (distance: number, length: number) => {
    for (let i = 0; i < length; i++) out.push(out.at(-distance) ?? 0);
  };
  while (at < input.length) {
    if ((control & 0x100) === 0) control = input[at++] | 0xff00;
    const bit = control & 1;
    control >>= 1;
    const b = input[at];
    if (bit === 0) {
      out.push(b);
      at++;
      continue;
    }
    if ((b & 0x80) === 0) {
      copy(((b & 3) << 8) | input[at + 1], (b >> 2) + 3);
      at += 2;
      continue;
    }
    at++;
    if ((b & 0x40) === 0) {
      copy((b & 0xf) + 1, (b >> 4) - 6);
      continue;
    }
    if (b === 0xff) break;
    for (let i = 0; i < b - 0xb8; i++) out.push(input[at++]);
  }
  return Uint8Array.from(out);
}

export interface Embedded {
  /** ポインタ表のELF offset */
  at: number;
  count: number;
  /** この番号以上のtileがELFに埋め込まれている */
  first: number;
}

/**
 * ELFに埋め込まれたtileのポインタ表を探す。
 * 指し先の先頭u32が種別(0か1)である値が続く、最も長い並びを採る。
 * 表の末尾には使われない項目が残るので、先頭のtile番号は`IFS_ITEMS`から採る。
 */
export function findEmbedded(
  elf: Uint8Array,
  bias: number,
  first: number,
): Embedded | null {
  const view = new DataView(elf.buffer, elf.byteOffset, elf.byteLength);
  const kindOf = (at: number) => {
    const target = view.getUint32(at, true) - bias;
    if (target <= 0 || target + 8 >= elf.length) return -1;
    const kind = view.getUint32(target, true);
    return kind === 0 || kind === 1 ? kind : -1;
  };
  let best = { at: 0, count: 0 };
  let start = -1;
  let count = 0;
  for (let at = 0; at + 4 <= elf.length; at += 4) {
    if (kindOf(at) >= 0) {
      if (start < 0) start = at;
      count++;
      continue;
    }
    if (count > best.count) best = { at: start, count };
    start = -1;
    count = 0;
  }
  if (count > best.count) best = { at: start, count };
  if (best.count < 100) return null;
  return { at: best.at, count: best.count, first };
}

/** tileの画素をパレットのindexのまま返す。ELFに埋め込まれていないtileは null */
export function tileIndices(
  elf: Uint8Array,
  bias: number,
  embedded: Embedded,
  tile: number,
): { indices: Uint8Array; kind: number } | null {
  const index = tile - embedded.first;
  if (index < 0 || index >= embedded.count) return null;
  const view = new DataView(elf.buffer, elf.byteOffset, elf.byteLength);
  const at = view.getUint32(embedded.at + index * 4, true) - bias;
  const kind = view.getUint32(at, true);
  const raw = decompress(elf, at + 4);
  const indices = new Uint8Array(SIDE * SIDE);
  for (let i = 0; i < indices.length; i++) {
    if (kind === 1) {
      indices[i] = raw[i] ?? 0;
      continue;
    }
    const byte = raw[i >> 1] ?? 0;
    indices[i] = (i & 1) === 0 ? byte & 0xf : byte >> 4;
  }
  return { indices, kind };
}
