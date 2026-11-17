// red〜ddの "wp" v2 キー音バンクをPB用 "wp" v3 へ変換する。
// レイアウトはv3と同一で、違いはmagicと暗号化だけ。
// redは原盤時点で独自の鍵で暗号化済みなので、先に平文へ戻してからPBの鍵で掛け直す。

import {
  cipherKeysoundChannel,
  decryptFrames,
  isSilentFrame,
} from "../adpcm.ts";
import { EF_V1, WP_V2, WP_V3 } from "../form.ts";
import { inspectWpBank, KS_TABLE_END } from "./wp_bank.ts";

// era2 (9th〜red) の "ef" v1 キー音バンクをPB用 "wp" v3 へ変換する。
// 表は再構築せず、公式変換で実測した差分だけを適用する。
export function convertEfBankToWp(source: Uint8Array): Uint8Array {
  const bank = inspectWpBank(source, EF_V1, "入力ef v1");
  if (bank.isEncrypted !== 0) {
    throw new Error(`入力ef v1: is_encrypted=${bank.isEncrypted} で平文でない`);
  }
  // 暗号鍵はデータ先頭フレームから導出される
  if (!isSilentFrame(source, bank.dataOffset)) {
    throw new Error(
      "入力ef v1: データ先頭フレームが無音でないため暗号鍵を導出できない",
    );
  }
  const output = source.slice(0, bank.exactSize);
  const dv = new DataView(output.buffer, output.byteOffset, output.byteLength);
  dv.setUint32(0, WP_V3, true);
  dv.setUint32(KS_TABLE_END + 8, 1, true);
  for (const entry of bank.entries) {
    for (let ch = 0; ch < entry.channels; ch++) {
      cipherKeysoundChannel(
        output,
        bank.dataOffset + entry.offset + ch * entry.size,
        entry.size,
        true,
      );
    }
  }
  return output;
}

export function convertWp2BankToWp3(source: Uint8Array): Uint8Array {
  const bank = inspectWpBank(source, WP_V2, "入力wp v2");
  const output = source.slice(0, bank.exactSize);
  // file_entriesは本体を隙間なく覆うので、本体全体を一度に戻せる
  if (bank.isEncrypted === 1) {
    decryptFrames(output, bank.dataOffset, bank.exactSize);
  } else if (bank.isEncrypted !== 0) {
    throw new Error(`入力wp v2: is_encrypted=${bank.isEncrypted} が想定外`);
  }
  if (!isSilentFrame(output, bank.dataOffset)) {
    throw new Error("入力wp v2: 平文の先頭フレームが無音でない");
  }
  const dv = new DataView(output.buffer, output.byteOffset, output.byteLength);
  dv.setUint32(0, WP_V3, true);
  dv.setUint32(KS_TABLE_END + 8, 1, true);
  for (const entry of bank.entries) {
    for (let ch = 0; ch < entry.channels; ch++) {
      cipherKeysoundChannel(
        output,
        bank.dataOffset + entry.offset + ch * entry.size,
        entry.size,
        true,
      );
    }
  }
  return output;
}
