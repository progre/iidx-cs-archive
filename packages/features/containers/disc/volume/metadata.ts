// ISO9660のディレクトリレコードとPVDのボリューム長を、書き換える対象にする。
// 値は、リトルエンディアンとビッグエンディアンを続けた8バイトで書く。

import { SEC } from "@csa/core";

/** PVDはセクタ16にある。ボリューム長は先頭から80バイト目 */
const PVD_OFFSET = 16 * SEC;
const VOLUME_SECTORS_AT = 80;
/** ディレクトリレコードの先頭からextentの位置とsizeの位置 */
const RECORD_EXTENT_AT = 2;
const RECORD_SIZE_AT = 10;

/** ディレクトリレコードのextent・sizeの書き換え */
export interface MetadataPatch {
  lba: number;
  recordOffset: number;
  size: number;
}

export interface ByteWrite {
  bytes: Uint8Array;
  offset: number;
}

export function bothEndian(value: number): Uint8Array {
  const bytes = new Uint8Array(8);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, value, true);
  view.setUint32(4, value, false);
  return bytes;
}

/** セクタ16のPVD(1セクタぶん)に書かれたボリューム長(セクタ数) */
export function volumeSectorsOf(pvd: Uint8Array): number {
  return new DataView(pvd.buffer, pvd.byteOffset, pvd.byteLength).getUint32(
    VOLUME_SECTORS_AT,
    true,
  );
}

/** 書き換えるレコードごとにextentとsize、最後にPVDのボリューム長を書く */
export function metadataWrites(
  patches: readonly MetadataPatch[],
  volumeSectors: number,
): ByteWrite[] {
  return [
    ...patches.flatMap((patch) => [
      {
        offset: patch.recordOffset + RECORD_EXTENT_AT,
        bytes: bothEndian(patch.lba),
      },
      {
        offset: patch.recordOffset + RECORD_SIZE_AT,
        bytes: bothEndian(patch.size),
      },
    ]),
    {
      offset: PVD_OFFSET + VOLUME_SECTORS_AT,
      bytes: bothEndian(volumeSectors),
    },
  ];
}
