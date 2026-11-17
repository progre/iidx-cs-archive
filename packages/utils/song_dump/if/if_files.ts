// 1曲が指す`.if`を、用途と読み出し元の区間の一覧にする。
// 9th以降はDATA1、3rd〜8thは主アーカイブの`IFs`を指す。

import type { ElfDefinition } from "@csa/core";
import { isEmptySlot } from "@csa/contents-overlay";
import {
  type FileEntry,
  type FileTable,
  overlayFileOf,
} from "@csa/contents-file-table";
import type { SongDbRecord } from "@csa/contents-song-db";
import { data1EntryOf, type Data1Toc } from "./data1.ts";
import { join } from "@std/path";
import { Buffer } from "node:buffer";
import { Jimp } from "jimp";

export interface Rgba {
  height: number;
  rgba: Uint8Array;
  width: number;
}

export async function writePng(dir: string, name: string, image: Rgba) {
  const bitmap = {
    data: Buffer.from(image.rgba),
    height: image.height,
    width: image.width,
  };
  await Jimp.fromBitmap(bitmap).write(`${join(dir, name)}.png`);
}

export async function writeJson(dir: string, name: string, value: unknown) {
  const text = JSON.stringify(value, null, 2) + "\n";
  await Deno.writeTextFile(`${join(dir, name)}.json`, text);
}

export type IfUse = "overlay" | "title_card";

export interface SongIf {
  use: IfUse;
  entry: FileEntry;
}

function data1FilesOf(
  record: SongDbRecord,
  elf: Uint8Array,
  toc: Data1Toc,
): SongIf[] {
  const packages = (record.overlay.packages ?? [])
    .filter((index) => !isEmptySlot(index))
    .map((index) => ({
      use: "overlay" as const,
      entry: data1EntryOf(elf, toc, index),
    }));
  const titleCard = record.artwork.titleCard;
  const titleCards = titleCard === 0 ? [] : [{
    use: "title_card" as const,
    entry: data1EntryOf(elf, toc, titleCard),
  }];
  return [...packages, ...titleCards];
}

/** DATA1 TOCを持たない世代(3rd〜8th)は`toc`がnull */
export function songIfsOf(
  record: SongDbRecord,
  elf: Uint8Array,
  def: ElfDefinition,
  table: FileTable,
  toc: Data1Toc | null,
): SongIf[] {
  if (toc != null) {
    return data1FilesOf(record, elf, toc);
  }
  const file = overlayFileOf(record, def.songDbRecordLayout.overlay, table);
  return file == null ? [] : [{ use: "overlay", entry: file }];
}

/** 曲の画像セット欄が指す共有画像セットのDATA1 index */
export function imageSetIndicesOf(record: SongDbRecord): number[] {
  return (record.artwork.imageSet ?? [])
    .map(([, index]) => index)
    .filter((index) => !isEmptySlot(index));
}
