// `IFs`を持たない曲は番号が無いので、枠が指すanimationの組で名を付ける。
// 同じ組の曲は同じ本を指し、DATA1に1本だけ置かれる。

import type { SourceSlice } from "@csa/core";
import type { OverlaySlot } from "./slots.ts";

export const elfTileName = (slots: readonly OverlaySlot[]): string =>
  "a" + slots.map((slot) => slot.animation).join("-");

/** ELFとこの名でアーカイブ名を作る。`overlayKey`が本と1対1になる */
const MARK = "#";
export const elfTileArchive = (
  elf: string,
  slots: readonly OverlaySlot[],
): string => elf + MARK + elfTileName(slots);

export const isElfTile = (archive: string, elf: string): boolean =>
  archive.startsWith(elf + MARK);

/** 本のファイル名(拡張子なし)。`IFs`があればその通し番号、無ければ組の名 */
export const overlayFileName = (
  fileIndex: number | null,
  slots: readonly OverlaySlot[],
): string =>
  fileIndex === null ? elfTileName(slots) : String(fileIndex).padStart(4, "0");

/** 主アーカイブにある`IFs`の位置。tileがELFに埋め込まれている曲は持たない */
export interface LegacyIfsSlice {
  archive: string;
  fileIndex: number;
  offset: number;
  size: number;
}

/** ELFを指す本はtileが埋め込みで、主アーカイブに実体が無い */
export const legacyIfsSlice = (
  item: SourceSlice,
  elf: string,
): LegacyIfsSlice | null =>
  isElfTile(item.sourceArchive, elf) ? null : {
    archive: item.sourceArchive,
    fileIndex: item.sourceFileIndex,
    offset: item.sourceOffset,
    size: item.sourceSize,
  };
