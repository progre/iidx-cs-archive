// 組を持たない曲の判定・読み込みが引く表と、記述子の置き場。
// 原盤の判定関数・読み込み関数・パッケージ表・記述子ポインター表のaddressも持つ。

import { STUB_SLOTS } from "../../../data/stub_area/mod.ts";

export const MATCH_SLOT = STUB_SLOTS.pairlessMatcher;
export const LOAD_SLOT = STUB_SLOTS.pairlessLoader;
/** 容量は既定行1と曲5と終端1の7行ぶんである */
export const TABLE_SLOT = STUB_SLOTS.pairlessTable;
/** 容量は記述子5本ぶんである */
export const DESCRIPTOR_SLOT = STUB_SLOTS.pairlessDescriptors;
export const MATCH_STUB = MATCH_SLOT.vaddr;
export const LOAD_STUB = LOAD_SLOT.vaddr;
export const TABLE = TABLE_SLOT.vaddr;
export const DESCRIPTORS = DESCRIPTOR_SLOT.vaddr;
const DESCRIPTOR_SIZE = 0x140;

/** 原盤の判定関数。先頭2語を表引きstubへの`j`に差し替える */
export const MATCHER_HEAD = 0x2276b0;
export const MATCHER_HEAD_WORDS = 2;
/** 原盤の読み込み関数で、枠を0固定にする4語 */
export const LOADER_SITE = 0x0022a36c;
export const LOADER_SITE_WORDS = 4;
/**
 * 差し替える4語の直後にある、枠を`obj+0x78`へ書く命令。
 * stubはここへ戻る。
 */
export const LOAD_CONTINUE = 0x0022a37c;
/** 曲DB indexからパッケージのDATA1 indexを引く表。frameで添字するu32配列 */
export const PACKAGE_TABLE_ADDR = 0x002aea98;
/**
 * 記述子のaddressを持つ表。
 * 原盤はこの表をgp相対で読む。
 * 書くときは絶対addressでよい。
 */
export const DESCRIPTOR_POINTER_ADDR = 0x002b1e7c;
/** `LOAD_CONTINUE`の命令の即値offsetで`PACKAGE_TABLE_ADDR`から`DESCRIPTOR_POINTER_ADDR`へ届く距離 */
export const PACKAGE_TO_DESCRIPTOR_OFFSET = DESCRIPTOR_POINTER_ADDR -
  PACKAGE_TABLE_ADDR;

/** 行の語。`songIndex`が`-1`の行は終端 */
export const ROW_FIELDS = ["songIndex", "packageIndex", "descriptor"] as const;
export const ROW_SIZE = ROW_FIELDS.length * 4;
export const fieldOffset = (name: typeof ROW_FIELDS[number]): number =>
  ROW_FIELDS.indexOf(name) * 4;

export interface PairlessRow {
  descriptor: number;
  packageIndex: number;
  songIndex: number;
}

/** 曲DB indexの昇順に並べる */
function orderedRows(rows: readonly PairlessRow[]): PairlessRow[] {
  return [...rows].sort((a, b) => a.songIndex - b.songIndex);
}

/** 表のバイト列。`songIndex`が`-1`の終端行で終わる */
export function tableBytes(rows: readonly PairlessRow[]): Uint8Array {
  const ordered = [
    ...orderedRows(rows),
    { descriptor: 0, packageIndex: -1, songIndex: -1 },
  ];
  const bytes = new Uint8Array(ordered.length * ROW_SIZE);
  const view = new DataView(bytes.buffer);
  ordered.forEach((row, index) => {
    const at = index * ROW_SIZE;
    view.setInt32(at + fieldOffset("songIndex"), row.songIndex, true);
    view.setInt32(at + fieldOffset("packageIndex"), row.packageIndex, true);
    view.setUint32(at + fieldOffset("descriptor"), row.descriptor, true);
  });
  return bytes;
}

/** 記述子のバイト列を連結する。並びは受け取った順のまま */
export function descriptorBytes(
  descriptors: readonly Uint8Array[],
): Uint8Array {
  const bytes = new Uint8Array(descriptors.length * DESCRIPTOR_SIZE);
  descriptors.forEach((descriptor, index) => {
    if (descriptor.length !== DESCRIPTOR_SIZE) {
      throw new Error(`記述子の長さが0x140でない: ${index}`);
    }
    bytes.set(descriptor, index * DESCRIPTOR_SIZE);
  });
  return bytes;
}

export function descriptorAddress(index: number): number {
  return DESCRIPTORS + index * DESCRIPTOR_SIZE;
}

/** 書き込んだ表を頭から読み、終端行まで(含む)を返す。`elf`は読み戻しにだけ使う */
export function readRows(elf: { u32(vaddr: number): number }): PairlessRow[] {
  const rows: PairlessRow[] = [];
  for (let index = 0; index < TABLE_SLOT.bytes / ROW_SIZE; index++) {
    const at = TABLE + index * ROW_SIZE;
    const songIndex = elf.u32(at + fieldOffset("songIndex")) | 0;
    rows.push({
      descriptor: elf.u32(at + fieldOffset("descriptor")),
      packageIndex: elf.u32(at + fieldOffset("packageIndex")) | 0,
      songIndex,
    });
    if (songIndex === -1) break;
  }
  return rows;
}
