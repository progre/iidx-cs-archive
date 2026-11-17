// キー音・BGMのバイト列だけから形式を判別する。
// 世代から期待される形式と、その突き合わせは selection/definitions が持つ。

import type { BgmForm, KeysoundForm } from "@csa/core";

export type { BgmForm };

/** キー音バンクのマジック (LE u32) */
export const EF_V1 = 0x00016665;
/** red〜ddの全曲が持つ。v3への変換は keysound_wp2.ts */
export const WP_V2 = 0x00027077;
export const WP_V3 = 0x00037077;
/** BGM `01 00 64 08` (.vig) のマジック (LE u32) */
export const VIG_MAGIC = 0x08640001;

function u32(buf: Uint8Array, at: number, littleEndian: boolean): number {
  return new DataView(buf.buffer, buf.byteOffset, buf.byteLength).getUint32(
    at,
    littleEndian,
  );
}

/**
 * ヘッダレス旧バンクは先頭u32がファイル長である。
 * raw抽出はセクタ切上げで長くなることがある。そこで1セクタ未満の余りは許す。
 * 先頭だけ読んで判定するときは`totalLength`にファイル長を渡す。
 */
export function detectKeysoundForm(
  buf: Uint8Array,
  totalLength = buf.length,
): KeysoundForm {
  if (buf.length < 16) throw new Error("キー音バンクが短すぎる");
  const head = u32(buf, 0, true);
  if (head === EF_V1) return "ef1";
  if (head === WP_V2) return "wp2";
  if (head === WP_V3) return "wp3";
  if (head <= totalLength && totalLength - head < 0x800) return "headerless";
  throw new Error(
    `キー音バンクの形式を判定できない: 先頭u32=0x${head.toString(16)}`,
  );
}

/**
 * era1のビッグエンディアンヘッダは長さが一定でない。
 * そこで`data_size`がファイルに収まり、レートとチャンネル数が妥当ならera1とみる。
 * レートの上限は形式判定のための健全性検査である。
 * 48006〜48014の素材16本を通す。
 */
const BGM_RATE_MAX = 48100;
export function detectBgmForm(
  buf: Uint8Array,
  totalLength = buf.length,
): BgmForm {
  if (buf.length < 16) throw new Error("BGMが短すぎる");
  if (u32(buf, 0, true) === VIG_MAGIC) return "vig";
  const dataSize = u32(buf, 0, false);
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const rate = dv.getUint16(6, false);
  const channels = buf[8];
  if (
    dataSize < totalLength && rate >= 8000 && rate <= BGM_RATE_MAX &&
    (channels === 1 || channels === 2)
  ) return "bigendian";
  throw new Error(
    `BGMの形式を判定できない: 先頭u32(BE)=0x${dataSize.toString(16)}`,
  );
}
