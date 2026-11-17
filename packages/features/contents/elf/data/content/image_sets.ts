/**
 * 組み直した共有画像セットへ既存indexのTOC行を向け直し、
 * 追加曲の曲DBの参照欄を画像セット内の新しいsprite番号へ書き換える。
 * 既存indexのポインタは原盤のTOCを指したままなので、原盤と移設先の両方の行を書く。
 */

import type { MutableElf } from "../../elf/mod.ts";
import type { Data1Row, SongContent } from "../../model/mod.ts";
import { PB_DATA1_COUNT, PB_DATA1_TOC_VADDR } from "../segment/mod.ts";
import { type Data1Tables, TOC_ROW, writeNewRow } from "./data1.ts";
import {
  type CsaSongDb,
  entryAddressOf,
  type EntryFormat,
  layoutOf,
} from "./song_db.ts";

/** 共有画像セットのsprite参照の並び */
function titleSpritesOf(format: EntryFormat) {
  const { imageSet } = layoutOf(format).artwork;
  if (imageSet === null) {
    throw new Error("PBの定義に共有画像セットの欄が無い");
  }
  return imageSet;
}

function writeTocRow(
  elf: MutableElf,
  tables: Data1Tables,
  imageSet: Data1Row,
): void {
  const index = imageSet.newData1Index;
  if (index >= PB_DATA1_COUNT) {
    writeNewRow(
      elf,
      tables,
      index,
      imageSet.relativeSector,
      imageSet.sectors,
    );
    return;
  }
  for (const base of [PB_DATA1_TOC_VADDR, tables.toc]) {
    const row = base + index * TOC_ROW;
    if (elf.u32(row) !== index) {
      throw new Error(`DATA1 TOC[${index}]のidが一致しない`);
    }
    elf.setU32(row + 4, imageSet.relativeSector);
    elf.setU32(row + 8, imageSet.sectors);
  }
}

export function writeImageSets(
  elf: MutableElf,
  tables: Data1Tables,
  songDb: CsaSongDb,
  content: SongContent,
  imageSets: readonly Data1Row[],
): void {
  const titleSprites = titleSpritesOf(songDb.format);
  for (const imageSet of imageSets) writeTocRow(elf, tables, imageSet);
  const available = new Set(imageSets.map((row) => row.newData1Index));
  for (const song of content.songs) {
    const sprites = song.titleSprites;
    if (sprites === undefined) continue;
    if (sprites.length !== titleSprites.count) {
      throw new Error(
        `song${song.targetSongIndex}の画像セット参照が${sprites.length}件`,
      );
    }
    const entry = entryAddressOf(songDb, song.targetSongIndex);
    sprites.forEach((sprite, slot) => {
      if (!available.has(sprite.fileIndex)) {
        throw new Error(
          `song${song.targetSongIndex}が未生成の画像セットを指す`,
        );
      }
      const at = entry + titleSprites.offset + slot * 4;
      elf.setU16(at, sprite.sprite);
      elf.setU16(at + 2, sprite.fileIndex);
    });
  }
}

export function verifyImageSets(
  elf: MutableElf,
  tables: Data1Tables,
  songDb: CsaSongDb,
  content: SongContent,
  imageSets: readonly Data1Row[],
): void {
  const titleSprites = titleSpritesOf(songDb.format);
  for (const imageSet of imageSets) {
    const index = imageSet.newData1Index;
    if (
      index >= PB_DATA1_COUNT &&
      elf.u32(tables.pointers + index * 4) !== tables.toc + index * TOC_ROW
    ) {
      throw new Error(`画像セット${index}のポインタが移設先を指していない`);
    }
    const bases = index >= PB_DATA1_COUNT
      ? [tables.toc]
      : [PB_DATA1_TOC_VADDR, tables.toc];
    for (const base of bases) {
      const row = base + index * TOC_ROW;
      if (
        elf.u32(row) !== index ||
        elf.u32(row + 4) !== imageSet.relativeSector ||
        elf.u32(row + 8) !== imageSet.sectors
      ) {
        throw new Error(`画像セット${index}のTOCが読み戻せない`);
      }
    }
  }
  for (const song of content.songs) {
    if (song.titleSprites === undefined) continue;
    const entry = entryAddressOf(songDb, song.targetSongIndex);
    song.titleSprites.forEach((sprite, slot) => {
      const at = entry + titleSprites.offset + slot * 4;
      if (
        elf.u16(at) !== sprite.sprite || elf.u16(at + 2) !== sprite.fileIndex
      ) {
        throw new Error(
          `song${song.targetSongIndex}の画像セット参照${slot}が読み戻せない`,
        );
      }
    });
  }
}
