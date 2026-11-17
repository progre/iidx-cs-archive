// 曲DBエントリーから曲名カードのDATA1 TOC番号と、共有画像セットのsprite参照を読む。
// 欄のオフセットは世代の定義の`artwork`が持つ。読み方はlayouts.tsのDisplayLayoutが定める。
// 曲中オーバーレイは別の欄にあり、read/entry.tsのreadOverlayが読む。

import type { ArtworkLayout, Slots, TitleSpriteRef } from "@csa/core";
import type { DisplayLayout } from "./layouts.ts";

/** 9th以降だけが持つ並び。持たない世代で読もうとしたら止める */
function slotsOf(slots: Slots | null, name: string): Slots {
  if (slots === null) {
    throw new Error(`${name}のオフセットが定義に無い`);
  }
  return slots;
}

/** 曲DBエントリーの曲名カード欄。0かdata1TocCount以上は不正として例外にする */
export function readTitleCardTocIndex(
  elf: Uint8Array,
  entryOffset: number,
  layout: Pick<DisplayLayout, "data1TocCount">,
  artwork: Pick<ArtworkLayout, "titleCard">,
): number {
  const dv = new DataView(elf.buffer, elf.byteOffset, elf.byteLength);
  const index = dv.getUint32(entryOffset + artwork.titleCard.offset, true);
  if (index === 0 || index >= layout.data1TocCount) {
    throw new Error("曲名カードのDATA1 TOC番号が不正: " + index);
  }
  return index;
}

/** 曲名カード欄の組。`file`は、組の`animation`で使うDATA1 TOC番号である */
export interface TitleCardField {
  animation: number;
  file: number;
}

/** 曲DBエントリーから、`{u16 animation, u16 DATA1 index}`の組を、定義の数だけ1組ずつ読む */
export function readTitleCardPairs(
  elf: Uint8Array,
  entryOffset: number,
  artwork: Pick<ArtworkLayout, "titleCardPairs">,
): TitleCardField[] {
  const pairs = slotsOf(artwork.titleCardPairs, "曲名カードの組");
  const dv = new DataView(elf.buffer, elf.byteOffset, elf.byteLength);
  return Array.from({ length: pairs.count }, (_, i) => {
    const offset = entryOffset + pairs.offset + i * 4;
    return {
      animation: dv.getUint16(offset, true),
      file: dv.getUint16(offset + 2, true),
    };
  });
}

/**
 * 素材世代の曲DBエントリーから、画像セット欄のsprite参照をPBの4欄の順に読む。
 * どの欄にも使われていない素材の共有画像セットがあれば、例外にする。
 */
export function readSourceTitleRefs(
  sourceElf: Uint8Array,
  entryOffset: number,
  layout: Pick<DisplayLayout, "imageSet" | "imageSetSlots">,
  artwork: Pick<ArtworkLayout, "imageSet">,
): TitleSpriteRef[] {
  const imageSet = slotsOf(artwork.imageSet, "共有画像セット");
  const dv = new DataView(
    sourceElf.buffer,
    sourceElf.byteOffset,
    sourceElf.byteLength,
  );
  const refs = layout.imageSetSlots.map((slot) => {
    const offset = entryOffset + imageSet.offset + slot * 4;
    return {
      fileIndex: dv.getUint16(offset + 2, true),
      sprite: dv.getUint16(offset, true),
    };
  });
  const files = new Set(refs.map((ref) => ref.fileIndex));
  for (const index of Object.values(layout.imageSet)) {
    if (!files.has(index)) {
      throw new Error(`曲DBが素材画像セット${index}を参照していない`);
    }
  }
  return refs;
}
