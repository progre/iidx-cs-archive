// legacy(3rd〜8th)の主アーカイブにある`IFs`から、通し番号でtileを引く。
// 見出しは`+0x04`が先頭、`+0x08`が末尾の通し番号で、`+0x0c`からのu32表が項目の位置を
// 4バイト単位で持つ。

import { decompress, SIDE } from "./tile.ts";

export interface IfsTile {
  indices: Uint8Array;
  /** 0が4bpp、1が8bpp */
  kind: number;
}

/** 通し番号でtileを引く。この`IFs`が持たない番号はnull */
export type TileOf = (serial: number) => IfsTile | null;

/** offset表の原点はファイル先頭である(原盤は先頭+表の値で項目の位置を求める) */
const TABLE_OFFSET = 0x0c;

function expand(raw: Uint8Array, kind: number): Uint8Array {
  const indices = new Uint8Array(SIDE * SIDE);
  for (let i = 0; i < indices.length; i++) {
    if (kind === 1) {
      indices[i] = raw[i] ?? 0;
      continue;
    }
    const byte = raw[i >> 1] ?? 0;
    indices[i] = (i & 1) === 0 ? byte & 0xf : byte >> 4;
  }
  return indices;
}

export function openIfs(bytes: Uint8Array): TileOf {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const first = view.getUint32(4, true);
  const last = view.getUint32(8, true);
  const cache = new Map<number, IfsTile>();
  return (serial) => {
    if (serial < first || serial > last) return null;
    const found = cache.get(serial);
    if (found !== undefined) return found;
    const at = view.getUint32(TABLE_OFFSET + (serial - first) * 4, true) * 4;
    const kind = view.getUint32(at, true);
    if (kind > 1) throw new Error(`tile${serial}の種別が${kind}`);
    const tile = { indices: expand(decompress(bytes, at + 4), kind), kind };
    cache.set(serial, tile);
    return tile;
  };
}
