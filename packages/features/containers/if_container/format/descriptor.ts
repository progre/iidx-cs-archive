// `.if`コンテナの記述子開始位置をPBのloaderが読む`+8`へ揃える。
// 9th〜redは`u16 dataOffset, u16 texture数`の直後(`+4`)から記述子が始まる。
// 4バイト詰めて`dataOffset`に4を足すだけで、圧縮データもmetadataもそのまま使える。
import type { DescriptorStart } from "@csa/core";
import { HEADER_BYTES, parseIfPackage, SECTOR_BYTES } from "./container.ts";

const SHIFT = HEADER_BYTES - 4;

/** 先頭の`u16 dataOffset, u16 texture数`の大きさ */
const COUNTS_BYTES = 4;

/**
 * 記述子が示す、圧縮データの終わりの位置。容量はこの長さで数える。
 * 記述子の開始位置は世代で違う(`+4`か`+8`)が、`dataOffset`は記述子の直後を指すので、そこから逆に求める。
 * 9th以降の原盤は、この位置からセクタ終端までが0とは限らない
 */
export async function ifPayloadLength(
  read: (offset: number, length: number) => Promise<Uint8Array>,
): Promise<number> {
  const viewOf = (bytes: Uint8Array) =>
    new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const counts = viewOf(await read(0, COUNTS_BYTES));
  const dataOffset = counts.getUint16(0, true);
  const fileCount = counts.getUint16(2, true) + 1;
  const dv = viewOf(await read(0, dataOffset));
  const start = dataOffset - fileCount * 8;
  return Array.from({ length: fileCount }, (_, i) => i).reduce(
    (end, i) => end + dv.getUint32(start + i * 8 + 4, true),
    dataOffset,
  );
}

/**
 * 記述子を`+8`から始まる形にし、長さをセクタ倍数に保つ。
 * 圧縮データの末尾より後ろは読まれないので、詰めた4バイトが収まらないときだけ1セクタ足す。
 */
export function normalizeIfDescriptors(
  bytes: Uint8Array,
  descriptorStart: DescriptorStart,
): Uint8Array {
  if (descriptorStart === HEADER_BYTES) return bytes;
  if (bytes.length % SECTOR_BYTES !== 0) {
    throw new Error(`.ifの長さ${bytes.length}がセクタ倍数でない`);
  }
  const shifted = new Uint8Array(bytes.length + SHIFT);
  shifted.set(bytes.subarray(0, 4), 0);
  shifted.set(bytes.subarray(4), HEADER_BYTES);
  const dv = new DataView(shifted.buffer);
  dv.setUint16(0, dv.getUint16(0, true) + SHIFT, true);
  const { payloadEnd } = parseIfPackage(shifted);
  const length = Math.ceil(payloadEnd / SECTOR_BYTES) * SECTOR_BYTES;
  if (length > shifted.length) {
    throw new Error(".ifの圧縮データが記述子の位置と合わない");
  }
  return shifted.subarray(0, length);
}
