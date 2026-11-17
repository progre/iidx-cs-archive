/**
 * 移設したDATA1ポインタ表とTOCへ、曲名カードと曲中オーバーレイを登録する。
 * 既存1469件のポインタは原盤のTOCを指したままでよく、新しいindexだけ移設先の行を指す。
 */

import type { MutableElf } from "../../elf/mod.ts";
import type {
  AssetPlacement,
  Data1Row,
  SongContent,
  TitleCardRow,
} from "../../model/mod.ts";
import { CANARY } from "../segment/mod.ts";
import {
  type CsaSongDb,
  entryAddressOf,
  type EntryFormat,
  layoutOf,
} from "./song_db.ts";

export const TOC_ROW = 16;

/** 曲名カードとオーバーレイの欄のオフセット。PBの世代はどれも持つ */
function fieldsOf(format: EntryFormat) {
  const { artwork, overlay } = layoutOf(format);
  const { titleCardPairs } = artwork;
  const { packages, pairs } = overlay;
  if (titleCardPairs === null || packages === null || pairs === null) {
    throw new Error("PBの定義に曲名カードの組かオーバーレイの欄が無い");
  }
  return {
    overlayPackages: packages.offset,
    overlayPairs: pairs.offset,
    titleCard: artwork.titleCard.offset,
    titleCardPairs,
  };
}

type Fields = ReturnType<typeof fieldsOf>;

export interface Data1Tables {
  pointers: number;
  toc: number;
}

const isCanary = (elf: MutableElf, vaddr: number, bytes: number) =>
  elf.slice(vaddr, bytes).every((byte) => byte === CANARY);

/** 新しいindexのTOC行とポインタを書く。書込み先が空でなければ止める */
export function writeNewRow(
  elf: MutableElf,
  tables: Data1Tables,
  index: number,
  relativeSector: number,
  sectors: number,
): void {
  const row = tables.toc + index * TOC_ROW;
  const pointer = tables.pointers + index * 4;
  if (!isCanary(elf, row, TOC_ROW) || !isCanary(elf, pointer, 4)) {
    throw new Error(`DATA1[${index}]の書込み先が空でない`);
  }
  elf.setU32(row, index);
  elf.setU32(row + 4, relativeSector);
  elf.setU32(row + 8, sectors);
  elf.setU32(row + 12, 0);
  elf.setU32(pointer, row);
}

function writeFile(
  elf: MutableElf,
  tables: Data1Tables,
  file: Data1Row,
  baseLba: number,
): void {
  if (baseLba + file.relativeSector !== file.lba) {
    throw new Error(`DATA1[${file.newData1Index}]の相対セクタがLBAと合わない`);
  }
  writeNewRow(
    elf,
    tables,
    file.newData1Index,
    file.relativeSector,
    file.sectors,
  );
}

/** 複製元の組が残っているので、組は全枠を書き直す */
function pointTitleCard(
  elf: MutableElf,
  entry: number,
  card: TitleCardRow,
  fields: Fields,
): void {
  const { count, offset } = fields.titleCardPairs;
  if (card.pairs.length > count) {
    throw new Error(`曲名カード${card.newData1Index}の組が多すぎる`);
  }
  elf.setU32(entry + fields.titleCard, card.newData1Index);
  for (let slot = 0; slot < count; slot++) {
    const pair = card.pairs[slot] ?? { animation: 0, titleCard: 0 };
    const at = entry + offset + slot * 4;
    elf.setU16(at, pair.animation);
    elf.setU16(at + 2, pair.titleCard === 0 ? 0 : card.newData1Index);
  }
}

export function writeData1(
  elf: MutableElf,
  tables: Data1Tables,
  songDb: CsaSongDb,
  content: SongContent,
  placement: AssetPlacement,
): void {
  const entryAt = (index: number) => entryAddressOf(songDb, index);
  const fields = fieldsOf(songDb.format);
  for (const card of placement.titleCards) {
    writeFile(elf, tables, card, placement.data1BaseLba);
    for (const songIndex of card.targetSongIndices) {
      pointTitleCard(elf, entryAt(songIndex), card, fields);
    }
  }
  for (const item of placement.overlayPackages) {
    writeFile(elf, tables, item, placement.data1BaseLba);
  }
  for (const song of content.songs) {
    const entry = entryAt(song.targetSongIndex);
    elf.setBytes(entry + fields.overlayPackages, song.overlayFields.packages);
    elf.setBytes(entry + fields.overlayPairs, song.overlayFields.pairs);
  }
}

const sameBytes = (actual: Uint8Array, expected: Uint8Array) =>
  actual.every((byte, index) => byte === expected[index]);

function verifyRow(
  elf: MutableElf,
  tables: Data1Tables,
  file: Data1Row,
): void {
  const row = tables.toc + file.newData1Index * TOC_ROW;
  if (
    elf.u32(tables.pointers + file.newData1Index * 4) !== row ||
    elf.u32(row) !== file.newData1Index ||
    elf.u32(row + 4) !== file.relativeSector ||
    elf.u32(row + 8) !== file.sectors ||
    elf.u32(row + 12) !== 0
  ) {
    throw new Error(`DATA1[${file.newData1Index}]のTOCが読み戻せない`);
  }
}

export function verifyData1(
  elf: MutableElf,
  tables: Data1Tables,
  songDb: CsaSongDb,
  content: SongContent,
  placement: AssetPlacement,
): void {
  const entryAt = (index: number) => entryAddressOf(songDb, index);
  const fields = fieldsOf(songDb.format);
  const pairs = fields.titleCardPairs;
  for (const card of placement.titleCards) {
    verifyRow(elf, tables, card);
    for (const songIndex of card.targetSongIndices) {
      const entry = entryAt(songIndex);
      if (elf.u32(entry + fields.titleCard) !== card.newData1Index) {
        throw new Error(`song${songIndex}の曲名カードが読み戻せない`);
      }
      for (let slot = 0; slot < pairs.count; slot++) {
        const pair = card.pairs[slot] ?? { animation: 0, titleCard: 0 };
        const at = entry + pairs.offset + slot * 4;
        const want = pair.titleCard === 0 ? 0 : card.newData1Index;
        if (elf.u16(at) !== pair.animation || elf.u16(at + 2) !== want) {
          throw new Error(`song${songIndex}の曲名カードの組${slot}が違う`);
        }
      }
    }
  }
  for (const item of placement.overlayPackages) verifyRow(elf, tables, item);
  for (const song of content.songs) {
    const entry = entryAt(song.targetSongIndex);
    const overlay = song.overlayFields;
    if (
      !sameBytes(
        elf.slice(entry + fields.overlayPackages, overlay.packages.length),
        overlay.packages,
      ) ||
      !sameBytes(
        elf.slice(entry + fields.overlayPairs, overlay.pairs.length),
        overlay.pairs,
      )
    ) {
      throw new Error(`song${song.targetSongIndex}のオーバーレイの欄が違う`);
    }
  }
}
