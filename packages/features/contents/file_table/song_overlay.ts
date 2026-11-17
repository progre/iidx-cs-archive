// 曲DBの1曲が使う曲中オーバーレイの`IFs`を、ELFのファイル表から引く。3rd〜8thのみ。

import type { ArchiveRule, ElfDefinition, OverlayLayout } from "@csa/core";
import type { FileFieldsRecord } from "./archive_rule.ts";
import { entryByRule } from "./archive_rule.ts";
import { type FileEntry, FileTable } from "./file_table.ts";

const NO_FILE = 0xffff;

export interface LegacyOverlayFile {
  entry: FileEntry;
  /** 譜面や音声と同じ連結インデックス。manifestの`sourceFileIndex`に入れる */
  serial: number;
}

/**
 * manifestの`sourceFileIndex`は、譜面や音声と同じ連結インデックスである。
 * `overlap`の世代では、連結インデックスはBの後ろにCが続く。
 * 一方、曲DBの値は、Cの曲ではCの中の行番号である。
 * `origin`でオーバーレイを使う世代は無い。連結の順を確かめていないので例外にする。
 */
function serialOf(
  rule: ArchiveRule | null,
  value: number,
  table: FileTable,
): number {
  switch (rule) {
    case null:
      return value;
    case "overlap":
      return value < table.count(1) ? value : value + table.count(1);
    case "origin":
      throw new Error("originのオーバーレイの連結インデックスは未確認");
  }
}

/** 3rd〜8thの曲が使う`IFs`を引く。`IFs`が無い曲と、tileをELFに埋め込む曲はnull */
export function legacyOverlayFilesOf(
  db: { record(songId: number): FileFieldsRecord },
  layout: OverlayLayout,
  table: FileTable,
): (songId: number) => LegacyOverlayFile | null {
  return (songId) => {
    const record = db.record(songId);
    const entry = overlayFileOf(record, layout, table);
    if (entry == null) {
      return null;
    }
    return {
      entry,
      serial: serialOf(layout.archiveRule, record.overlay.file!, table),
    };
  };
}

/** 曲が`IFs`を持つかを引く */
export function hasOverlayFileOf(
  db: { record(songId: number): FileFieldsRecord },
  elf: Uint8Array,
  def: ElfDefinition,
): (songId: number) => boolean {
  const table = new FileTable(elf, def.fileTable);
  const layout = def.songDbRecordLayout.overlay;
  return (songId) => overlayFileOf(db.record(songId), layout, table) != null;
}

/** 世代の定義から、曲が使う`IFs`を引く関数を作る */
export const legacyOverlayFilesOfElf = (
  db: { record(songId: number): FileFieldsRecord },
  elf: Uint8Array,
  def: ElfDefinition,
): (songId: number) => LegacyOverlayFile | null =>
  legacyOverlayFilesOf(
    db,
    def.songDbRecordLayout.overlay,
    new FileTable(elf, def.fileTable),
  );

/** `IFs`を持たない曲と、欄の無い世代はnull */
export function overlayFileOf(
  record: FileFieldsRecord,
  layout: OverlayLayout,
  table: FileTable,
): FileEntry | null {
  const value = record.overlay.file;
  if (value == null || value === NO_FILE) {
    return null;
  }
  return entryByRule(layout.archiveRule, value, record, table);
}
