// `.if`コンテナの組み立て側。読み側は container.ts。
// 共有画像セットへspriteを足すために、metadataとtextureを圧縮して1本へまとめる。

import { compressedLengths, HEADER_BYTES } from "./container.ts";

const RING = 0x1000;
const RING_START = 0xfee;
const MIN_MATCH = 3;
const MAX_MATCH = 18;
/** 4KBリングLZSS。decodeLzssの逆で、参照は入力上の過去位置をリング座標へ写す */
export function encodeLzss(input: Uint8Array): Uint8Array {
  const out: number[] = [];
  const heads = new Map<number, number[]>();
  let items: number[] = [];
  let control = 0;
  let bit = 0;
  const flush = () => {
    out.push(control, ...items);
    items = [];
    control = 0;
    bit = 0;
  };
  const key = (p: number) =>
    (input[p] << 16) | (input[p + 1] << 8) | input[p + 2];
  let i = 0;
  while (i < input.length) {
    let bestLen = 0;
    let bestPos = 0;
    if (i + MIN_MATCH <= input.length) {
      const chain = heads.get(key(i)) ?? [];
      for (let c = chain.length - 1; c >= 0; c--) {
        const p = chain[c];
        if (i - p > RING) break;
        let len = 0;
        while (
          len < MAX_MATCH && i + len < input.length &&
          input[p + len] === input[i + len]
        ) len++;
        if (len > bestLen) {
          bestLen = len;
          bestPos = p;
          if (len === MAX_MATCH) break;
        }
      }
    }
    const step = bestLen >= MIN_MATCH ? bestLen : 1;
    if (bestLen >= MIN_MATCH) {
      const offset = (RING_START + bestPos) & (RING - 1);
      items.push(offset & 0xff, ((offset >> 4) & 0xf0) | (bestLen - MIN_MATCH));
    } else {
      control |= 1 << bit;
      items.push(input[i]);
    }
    for (let k = 0; k < step; k++) {
      if (i + k + MIN_MATCH <= input.length) {
        const chain = heads.get(key(i + k));
        if (chain) chain.push(i + k);
        else heads.set(key(i + k), [i + k]);
      }
    }
    i += step;
    if (++bit === 8) flush();
  }
  if (bit > 0) flush();
  return new Uint8Array(out);
}

export interface CompressedIfFile {
  compressed: Uint8Array;
  /** 展開後の長さ。記述子へ書く */
  decompressed: number;
}

/**
 * 圧縮済みのfileを記述子とdataOffsetで連結する。
 * ゲームのloaderはdataOffset欄を読まず、記述子を+8、
 * 圧縮データを`0x10 + sheet数×8`の固定位置から読む。ヘッダーは8バイトで+4はゼロ。
 */
export function packIfFiles(files: CompressedIfFile[]): Uint8Array {
  const dataOffset = HEADER_BYTES + files.length * 8;
  const total = dataOffset +
    files.reduce((n, file) => n + file.compressed.length, 0);
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  dv.setUint16(0, dataOffset, true);
  dv.setUint16(2, files.length - 1, true);
  let cursor = dataOffset;
  files.forEach((file, index) => {
    dv.setUint32(HEADER_BYTES + index * 8, file.decompressed, true);
    dv.setUint32(HEADER_BYTES + index * 8 + 4, file.compressed.length, true);
    out.set(file.compressed, cursor);
    cursor += file.compressed.length;
  });
  return out;
}

/**
 * 元の`.if`から、新しいmetadataと選んだsheetだけを入れた本を組む。
 * sheetの圧縮データは再圧縮せず、記述子の位置からそのまま写す。
 * `sheets`は元のsheet番号で、並びが新しい番号になる。
 */
export function repackIfPackage(
  source: Uint8Array,
  metadata: Uint8Array,
  sheets: readonly number[],
): Uint8Array {
  const dv = new DataView(source.buffer, source.byteOffset, source.byteLength);
  const lengths = compressedLengths(source);
  let at = HEADER_BYTES + lengths.length * 8;
  const files: CompressedIfFile[] = lengths.map((length, index) => {
    const file = {
      compressed: source.subarray(at, at + length),
      decompressed: dv.getUint32(HEADER_BYTES + index * 8, true),
    };
    at += length;
    return file;
  });
  return packIfFiles([
    { compressed: encodeLzss(metadata), decompressed: metadata.length },
    ...sheets.map((sheet) => files[sheet + 1]),
  ]);
}

/** 各fileを圧縮して1本へまとめる */
export function buildIfPackage(files: Uint8Array[]): Uint8Array {
  return packIfFiles(
    files.map((file) => ({
      compressed: encodeLzss(file),
      decompressed: file.length,
    })),
  );
}
