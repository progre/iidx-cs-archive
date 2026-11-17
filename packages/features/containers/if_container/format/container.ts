// `.if`コンテナの解析。曲名カード、共有画像セット、曲中オーバーレイが同じ形を使う。
// 構造は原盤の実データで裏取りしたもの。
//
// header: u16 dataOffset, u16 fileCount, u32 0 (8バイト)
// descriptor: +8から(fileCount+1)件 × {u32 decompressed, u32 compressed}。
// ゲームのloaderはdataOffset欄を読まず、この固定配置を前提にする。
// file 0: metadata(sheet寸法、sprite矩形、animation)
// file 1..: texture(0x400のRGBA32パレット + 8bpp swizzled画像)
// 各fileはLZSS(4KBリング、開始位置0xFEE)で個別に圧縮される

import type { IfMetadata, IfPackage } from "@csa/core";

export const HEADER_BYTES = 8;

/** `.if`はISOのセクタ境界に置かれるので、長さがセクタ倍数になる */
export const SECTOR_BYTES = 2048;

/** 選曲画面の`.if`読み込みバッファーの上限 */
export const SELECT_SCREEN_LIMIT_SECTORS = 0x300000 / SECTOR_BYTES;

export function decodeLzss(
  input: Uint8Array,
  decompressedSize: number,
): Uint8Array {
  const out = new Uint8Array(decompressedSize);
  const ring = new Uint8Array(0x1000);
  let ringPos = 0xfee;
  let idx = 0;
  let written = 0;
  let control = 0;
  while (written < decompressedSize) {
    control >>= 1;
    if ((control & 0x100) === 0) control = input[idx++] | 0xff00;
    if (control & 1) {
      const value = input[idx++];
      out[written++] = value;
      ring[ringPos] = value;
      ringPos = (ringPos + 1) & 0xfff;
      continue;
    }
    const low = input[idx++];
    const high = input[idx++];
    let length = (high & 0x0f) + 3;
    let offset = ((high & 0xf0) << 4) | low;
    while (length-- > 0 && written < decompressedSize) {
      const value = ring[offset];
      out[written++] = value;
      ring[ringPos] = value;
      ringPos = (ringPos + 1) & 0xfff;
      offset = (offset + 1) & 0xfff;
    }
  }
  return out;
}

export function parseMetadata(bytes: Uint8Array): IfMetadata {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const sheetCount = dv.getUint16(2, true);
  const animationCount = dv.getUint16(4, true);
  const spriteCount = dv.getUint16(6, true);
  const spriteInfoOffset = dv.getUint32(8, true);
  const animationsOffset = dv.getUint32(12, true);
  const sheets = Array.from({ length: sheetCount }, (_, i) => ({
    height: dv.getUint16(0x10 + i * 4 + 2, true),
    width: dv.getUint16(0x10 + i * 4, true),
  }));
  const sprites = Array.from({ length: spriteCount }, (_, i) => {
    const off = spriteInfoOffset + i * 8;
    return {
      h: dv.getUint16(off + 6, true),
      w: dv.getUint16(off + 4, true),
      x: dv.getUint16(off, true),
      y: dv.getUint16(off + 2, true),
    };
  });
  return {
    animationCount,
    animationsOffset,
    sheets,
    spriteInfoOffset,
    sprites,
  };
}

export function parseIfPackage(bytes: Uint8Array): IfPackage {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let dataOffset = dv.getUint16(0, true);
  const fileCount = dv.getUint16(2, true) + 1;
  const descriptorStart = HEADER_BYTES;
  if (dataOffset !== descriptorStart + fileCount * 8) {
    throw new Error(".if dataOffsetが固定配置と一致しない");
  }
  const files: Uint8Array[] = [];
  for (let i = 0; i < fileCount; i++) {
    const decompressed = dv.getUint32(descriptorStart + i * 8, true);
    const compressed = dv.getUint32(descriptorStart + i * 8 + 4, true);
    files.push(
      decodeLzss(
        bytes.subarray(dataOffset, dataOffset + compressed),
        decompressed,
      ),
    );
    dataOffset += compressed;
  }
  const metadata = parseMetadata(files[0]);
  return { files, metadata, payloadEnd: dataOffset };
}

/** 長さをセクタ倍数まで0で埋める。ISOのセクタ境界に置くファイルが使う */
export function padToSector(bytes: Uint8Array): Uint8Array {
  const padded = new Uint8Array(
    Math.ceil(bytes.length / SECTOR_BYTES) * SECTOR_BYTES,
  );
  padded.set(bytes);
  return padded;
}

/** 記述子が持つ圧縮長。metadataが先頭で、以降がtextureの順に並ぶ */
export function compressedLengths(bytes: Uint8Array): number[] {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const fileCount = dv.getUint16(2, true) + 1;
  return Array.from(
    { length: fileCount },
    (_, at) => dv.getUint32(HEADER_BYTES + at * 8 + 4, true),
  );
}

/** metadata(file 0)だけを取り出す。曲名カードの型に使う */
export const readIfMetadata = (bytes: Uint8Array): Uint8Array =>
  parseIfPackage(bytes).files[0];
