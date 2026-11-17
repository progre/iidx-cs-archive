// "ef" v1 / "wp" v2 / "wp" v3 キー音バンクの検査。
// 3形式のレイアウトは同一である。

import type { EF_V1, WP_V2, WP_V3 } from "../form.ts";

export const KS_TABLE_END = 0x8000;
export const FILE_TABLE = 0x8010;

export interface WpFileEntry {
  channels: number;
  id: number;
  offset: number;
  size: number;
}

export interface WpBank {
  dataOffset: number;
  dataTotal: number;
  entries: WpFileEntry[];
  /** `file_entries` の直後からADPCM本体の終わりまで。raw抽出の末尾パディングを含まない */
  exactSize: number;
  isEncrypted: number;
}

export function inspectWpBank(
  buf: Uint8Array,
  magic: typeof EF_V1 | typeof WP_V2 | typeof WP_V3,
  label: string,
): WpBank {
  if (buf.length < FILE_TABLE) {
    throw new Error(`${label}: ヘッダーが短い: ${buf.length}B`);
  }
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (dv.getUint32(0, true) !== magic) {
    throw new Error(
      `${label}: magic が想定外: 0x${dv.getUint32(0, true).toString(16)}`,
    );
  }
  if (dv.getUint32(4, true) !== 0x10) {
    throw new Error(`${label}: keysound_table_offset が0x10でない`);
  }
  const fileCount = dv.getUint32(KS_TABLE_END, true);
  const dataTotal = dv.getUint32(KS_TABLE_END + 4, true);
  const isEncrypted = dv.getUint32(KS_TABLE_END + 8, true);
  const dataOffset = FILE_TABLE + fileCount * 0x10;
  const exactSize = dataOffset + dataTotal;
  if (fileCount === 0 || dataOffset > buf.length || exactSize > buf.length) {
    throw new Error(`${label}: file_count/data_total がファイル範囲外`);
  }
  if (dataTotal % 16 !== 0) {
    throw new Error(`${label}: data_total が16の倍数でない`);
  }

  const entries: WpFileEntry[] = [];
  let expectedOffset = 0;
  for (let id = 0; id < fileCount; id++) {
    const p = FILE_TABLE + id * 0x10;
    const offset = dv.getUint32(p, true);
    const size = dv.getUint32(p + 4, true);
    const channels = dv.getUint16(p + 8, true);
    if (channels !== 1 && channels !== 2) {
      throw new Error(`${label}: file_id ${id} のchannels=${channels}`);
    }
    if (size === 0 || offset % 16 !== 0 || size % 16 !== 0) {
      throw new Error(`${label}: file_id ${id} のoffset/sizeが不正`);
    }
    if (offset !== expectedOffset || offset + size * channels > dataTotal) {
      throw new Error(`${label}: file_id ${id} のデータ配置が連続していない`);
    }
    expectedOffset += size * channels;
    entries.push({ channels, id, offset, size });
  }
  if (expectedOffset !== dataTotal) {
    throw new Error(`${label}: data_total がfile_entries合計と不一致`);
  }
  return { dataOffset, dataTotal, entries, exactSize, isEncrypted };
}
