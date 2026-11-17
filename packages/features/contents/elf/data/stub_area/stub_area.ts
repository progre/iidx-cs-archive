/**
 * 追加コードを置く高位PT_LOAD内の固定address。移設表と候補リストの後ろに取る。
 * `STUB_BASE`から`STUB_CAPACITY`までは、曲値16bit化のstubである。
 * `STUB_CAPACITY`から`EXTRA_BASE`までは、既定の解禁一覧とセーブ初期化のstubである。
 * `EXTRA_BASE`以降は、個別資産の追加コードである。
 * 高位PT_LOADは128MB RAMのスタック底`0x7F00000`に置く。
 * 全曲構成の移設表と候補リストは`0x7FA1000`手前まで伸びるので、基底はその後ろに置く。
 */

export const STUB_BASE = 0x7fb0000;
export const STUB_CAPACITY = 0x7000;
export const STUB_ALLOCATION = 0xf000;
export const EXTRA_BASE = STUB_BASE + 0x9000;

/**
 * 確保の中の1つの置き場。
 * `bytes`は容量である。
 * 容量は次の置き場までの隙間を含まない。
 */
export interface StubSlot {
  name: string;
  vaddr: number;
  bytes: number;
}

/**
 * 置き場ごとの`STUB_BASE`からの距離と容量。
 * 距離を変えるとELFのバイト列が変わるので、動かさない。
 */
const LAYOUT = {
  songValue: [0x0000, STUB_CAPACITY],
  unlock: [STUB_CAPACITY, 0x2000],
  heapGuardCode: [0x9000, 0x100],
  heapGuardData: [0x9100, 0x100],
  imageSetLoadCode: [0x9200, 0x200],
  imageSetLoadTable: [0x9400, 0x400],
  bgmOverrideCode: [0x9800, 0x400],
  bgmOverrideSeed: [0x9c00, 0x20],
  bgmOverrideTable: [0x9c20, 0x3e0],
  fiveKeysCode: [0xa000, 0x800],
  fiveKeysState: [0xa800, 0x10],
  fiveKeysTable: [0xa810, 0x7f0],
  pairlessMatcher: [0xb000, 0x48],
  pairlessLoader: [0xb048, 0x48],
  pairlessTable: [0xb0a0, 0x54],
  pairlessDescriptors: [0xb100, 0x640],
  addedFolder: [0xb780, 0x880],
  // 表の曲1曲に8曲まで付く裏エントリーの判定と表。1行24バイトで、288行まで入る
  bgmListCode: [0xc000, 0x400],
  bgmListTable: [0xc400, 0x1b00],
  // 裏を選んだ演奏で、譜面・ムービー・音を裏の曲から読ませるための、使う曲indexを返すstub
  bgmSongIndexCode: [0xdf00, 0x100],
  // オーバーレイをANOTHERのときだけ使う曲の判定と、その曲indexの表。表は`-1`で終わる
  overlaySwitchCode: [0xe000, 0x100],
  overlaySwitchTable: [0xe100, 0x100],
  // ライバルの画面のメニューで、名前の変更の項目でなければ決定を無視するstub
  rivalMenuCode: [0xe200, 0x40],
} as const;

export type StubSlotName = keyof typeof LAYOUT;

/** 置き場が先頭の昇順に並び、互いに重ならず、確保の内側に収まることを確かめる */
export function checkSlots(
  slots: readonly StubSlot[],
  base: number,
  allocation: number,
): void {
  slots.forEach((slot, index) => {
    const start = index === 0 ? base : slots[index - 1].vaddr +
      slots[index - 1].bytes;
    if (slot.vaddr < start) {
      throw new Error(`置き場が前と重なるか昇順でない: ${slot.name}`);
    }
    if (slot.vaddr + slot.bytes > base + allocation) {
      throw new Error(`置き場が確保の外へ出る: ${slot.name}`);
    }
  });
}

export const STUB_SLOTS = Object.fromEntries(
  Object.entries(LAYOUT).map(([name, [offset, bytes]]) => [
    name,
    { name, vaddr: STUB_BASE + offset, bytes },
  ]),
) as Record<StubSlotName, StubSlot>;

checkSlots(Object.values(STUB_SLOTS), STUB_BASE, STUB_ALLOCATION);
