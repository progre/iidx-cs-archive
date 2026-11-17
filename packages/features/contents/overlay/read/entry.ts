// 曲ごとのオーバーレイ。曲DBエントリの欄から、読み込む`.if`と演奏中に使う枚数を取る。
// 欄の配置は layouts.ts。量を見るための読みで、CSAへ移す参照は manifest 側が組む。

import type { ElfDefinition, SongOverlay } from "@csa/core";
import {
  type OverlayLayout,
  overlayLayout,
  type SheetOverlayLayout,
} from "./layouts.ts";

/** 空枠の書き方は世代で違い、0と0xFFFFの両方が使われる */
export const isEmptySlot = (value: number) => value === 0 || value === 0xffff;

/** 9th以降の欄を、解釈せずに読んだ値 */
export interface SheetOverlayFields {
  /** 空枠を除いた、読み込むDATA1 indexの一覧 */
  packages: number[];
  /** 枠の位置を保った組。DATA1 indexが空の組はnullである */
  pairs: ({ animation: number; index: number } | null)[];
}

export function readSheetOverlayFields(
  elf: Uint8Array,
  entryOffset: number,
  layout: SheetOverlayLayout,
): SheetOverlayFields {
  const dv = new DataView(elf.buffer, elf.byteOffset, elf.byteLength);
  const packages = Array.from(
    { length: layout.packageCount },
    (_, i) => dv.getUint16(entryOffset + layout.packagesOffset + i * 2, true),
  ).filter((value) => !isEmptySlot(value));
  const pairs = Array.from({ length: layout.pairCount }, (_, i) => {
    const at = entryOffset + layout.pairsOffset + i * 4;
    const index = dv.getUint16(at + 2, true);
    return isEmptySlot(index)
      ? null
      : { animation: dv.getUint16(at, true), index };
  });
  return { packages, pairs };
}

/** sheet形式の世代で、オーバーレイの欄を読む。ほかの形式の世代では`undefined`を返す */
export function sheetOverlayFieldsOf(
  definition: ElfDefinition,
  elf: Uint8Array,
  entryOffset: number,
): SheetOverlayFields | undefined {
  const layout = overlayLayout(definition);
  return layout.kind === "sheet"
    ? readSheetOverlayFields(elf, entryOffset, layout)
    : undefined;
}

export function readOverlay(
  layout: OverlayLayout,
  entry: Uint8Array,
): SongOverlay {
  const dv = new DataView(entry.buffer, entry.byteOffset, entry.byteLength);
  if (layout.kind === "legacy") {
    const kinds = Array.from(
      { length: layout.slotCount },
      (_, i) => dv.getUint16(layout.slotOffset + i * layout.slotStride, true),
    );
    return { packages: [], sheets: kinds.filter((kind) => kind !== 0).length };
  }
  const packages = Array.from(
    { length: layout.packageCount },
    (_, i) => dv.getUint16(layout.packagesOffset + i * 2, true),
  ).filter((index) => !isEmptySlot(index));
  const used = Array.from(
    { length: layout.pairCount },
    (_, i) => dv.getUint16(layout.pairsOffset + i * 4 + 2, true),
  ).filter((index) => !isEmptySlot(index));
  for (const index of used) {
    if (packages.includes(index)) continue;
    throw new Error(`オーバーレイの組が一覧に無い${index}を指す`);
  }
  return { packages, sheets: used.length };
}
