// 曲中オーバーレイ(演奏画面のレイヤー)を指す欄の配置。オフセットは世代の定義が持つ。
// 3rd〜8thは主アーカイブの`.if`を1本指し、9th以降はDATA1の`.if`を一覧で読み込んで組で使う。
// 曲名カードの`.if`とは別物で、欄も別にある。

import type { ElfDefinition } from "@csa/core";

/** 3rd〜8th。ファイル番号は世代ごとに規則が違うので、`file_table`の`overlayFileOf`で引く */
export interface LegacyOverlayLayout {
  kind: "legacy";
  /** 使う枠。先頭u16の種別が0の枠は使わない */
  slotCount: number;
  slotOffset: number;
  slotStride: number;
}

/** 9th以降。曲名カードと同じコンテナ形式の`.if`をDATA1から読む */
export interface SheetOverlayLayout {
  kind: "sheet";
  /** 読み込むDATA1 indexの一覧(u16)。0と0xFFFFは空枠 */
  packageCount: number;
  packagesOffset: number;
  /** `{u16 animation, u16 DATA1 index}`。DATA1 indexが空の組は使わない */
  pairCount: number;
  pairsOffset: number;
}

export type OverlayLayout = LegacyOverlayLayout | SheetOverlayLayout;

/** 世代の定義から、曲中オーバーレイを指す欄の配置を作る */
export function overlayLayout(
  { songDbRecordLayout: { overlay } }: ElfDefinition,
): OverlayLayout {
  if (overlay.slots !== null) {
    return {
      kind: "legacy",
      slotCount: overlay.slots.count,
      slotOffset: overlay.slots.offset,
      slotStride: overlay.slots.bytes,
    };
  }
  if (overlay.packages === null || overlay.pairs === null) {
    throw new Error("曲中オーバーレイのオフセットが定義に無い");
  }
  return {
    kind: "sheet",
    packageCount: overlay.packages.count,
    packagesOffset: overlay.packages.offset,
    pairCount: overlay.pairs.count,
    pairsOffset: overlay.pairs.offset,
  };
}

/** 主アーカイブの`IFs`と4段表から組み直す世代(3rd〜8th) */
export const isLegacyOverlay = (definition: ElfDefinition): boolean =>
  definition.songDbRecordLayout.overlay.slots !== null;
