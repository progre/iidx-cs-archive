// era1のBGMを `01 00 64 08` コンテナで `0x800 + filesize` ちょうどに組み直す。

import { reinterleaveBlocksToFrames } from "../adpcm.ts";
import { VIG_MAGIC } from "../form.ts";

const HEADER = 0x800;
/** 新コンテナのインターリーブ単位 (1 ADPCMフレーム) */
const INTERLEAVE = 0x10;

/**
 * era1 のビッグエンディアンヘッダ形式を変換する。
 * 本体は `0x800` ブロック交互から1フレーム交互へ並べ替えるだけで、リサンプル・
 * 再エンコード・暗号化はしない。ヘッダは定数から組み立て、曲ごとに変わる
 * `filesize` / `sample_rate` / `volume` の3欄だけを原盤から写す。
 */
export function convertEra1Bgm(raw: Uint8Array): Uint8Array {
  const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  const dataSize = dv.getUint32(0, false);
  // era1の +0x04 は新コンテナ +0x28 と同じ再生音量。テンプレートの値を残すと差し替え元の
  // 音量で鳴る
  const volume = dv.getUint16(4, false);
  const rate = dv.getUint16(6, false);
  const channels = raw[8];
  if (volume === 0) throw new Error("原盤の音量欄が0(無音になる)");
  if (channels !== 2) throw new Error(`ステレオ専用: ch=${channels}`);
  if (raw.length < dataSize) throw new Error("ファイルが datasize より小さい");

  // 原盤rawのヘッダ長は一定でなく末尾はセクタ切上げなので、本体は末尾から取る
  const body = reinterleaveBlocksToFrames(raw.slice(raw.length - dataSize));
  const out = new Uint8Array(HEADER + body.length);
  const d = new DataView(out.buffer);
  d.setUint32(0x00, VIG_MAGIC, true);
  d.setUint32(0x08, HEADER, true);
  d.setUint32(0x0c, body.length, true);
  d.setUint32(0x18, rate, true);
  d.setUint32(0x1c, channels, true);
  d.setUint32(0x20, 0, true); // is_encrypted=0 (本体は無変換)
  d.setUint32(0x24, INTERLEAVE, true);
  d.setUint32(0x28, volume, true);
  d.setUint32(0x2c, 1, true);
  // +0x04 / +0x10 loop_start / +0x14 loop_end / +0x30〜 は 0 のまま
  out.set(body, HEADER);
  return out;
}
