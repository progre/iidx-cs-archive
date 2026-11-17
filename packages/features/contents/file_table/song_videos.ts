// 曲DBの1曲が使うムービーを、ELFのファイル表から引く。

import type { ElfDefinition, VideoLayout } from "@csa/core";
import type { FileFieldsRecord } from "./archive_rule.ts";
import { entryByRule } from "./archive_rule.ts";
import { type FileEntry, FileTable } from "./file_table.ts";

/** slotはファイル名に付ける番号で、欄の並びの順 */
export interface VideoFile {
  slot: number;
  entry: FileEntry;
}

interface VideoRef {
  value: number;
  isSecondary: boolean;
}

/** 0と、欄の幅で負になる値は、ムービーを持たない印 */
function isAbsent(value: number, bytes: number): boolean {
  return value === 0 || value >= 2 ** (bytes * 8 - 1);
}

function primaryRefsOf(
  record: FileFieldsRecord,
  layout: VideoLayout,
): VideoRef[] {
  const values = record.video.primary
    .filter((value) => !isAbsent(value, layout.primary.bytes));
  const first = values.at(0);
  const derived = layout.derivesSecondary && first != null ? [first + 1] : [];
  return [...values, ...derived]
    .map((value) => ({ value, isSecondary: false }));
}

function secondaryRefsOf(
  record: FileFieldsRecord,
  layout: VideoLayout,
  primaryCount: number,
): VideoRef[] {
  const { secondary } = layout;
  if (secondary == null || (layout.secondaryIsFallback && primaryCount > 0)) {
    return [];
  }
  return (record.video.secondary ?? [])
    .filter((value) => !isAbsent(value, secondary.bytes))
    .map((value) => ({ value, isSecondary: true }));
}

function entryOf(
  ref: VideoRef,
  record: FileFieldsRecord,
  layout: VideoLayout,
  table: FileTable,
): FileEntry {
  const archive = record.video.secondaryArchive;
  if (ref.isSecondary && archive != null) {
    return table.entry(archive, ref.value);
  }
  return entryByRule(layout.archiveRule, ref.value, record, table);
}

const isSameFile = (a: FileEntry, b: FileEntry) =>
  a.archive === b.archive && a.index === b.index;

/** 曲DBの全曲について、曲が使うムービーのファイルを並べる */
/** 世代の定義から、曲ごとのムービーの一覧を作る */
export const songVideoRecordsOfElf = (
  db: Parameters<typeof songVideoRecordsOf>[0],
  elf: Uint8Array,
  def: ElfDefinition,
): ReturnType<typeof songVideoRecordsOf> =>
  songVideoRecordsOf(
    db,
    def.songDbRecordLayout.video,
    new FileTable(elf, def.fileTable),
  );

export function songVideoRecordsOf(
  db: {
    readonly length: number;
    record(id: number): FileFieldsRecord & { title: { text: string } };
  },
  layout: VideoLayout,
  table: FileTable,
): { entries: FileEntry[]; id: number; title: string }[] {
  return Array.from({ length: db.length }, (_, id) => {
    const record = db.record(id);
    return {
      entries: videoFilesOf(record, layout, table).map(({ entry }) => entry),
      id,
      title: record.title.text,
    };
  });
}

/** 同じファイルを指す欄は、先の1つだけを残す */
export function videoFilesOf(
  record: FileFieldsRecord,
  layout: VideoLayout,
  table: FileTable,
): VideoFile[] {
  const primary = primaryRefsOf(record, layout);
  const refs = [
    ...primary,
    ...secondaryRefsOf(record, layout, primary.length),
  ];
  const files = refs.map((ref, slot) => ({
    slot,
    entry: entryOf(ref, record, layout, table),
  }));
  return files.filter((file, i) =>
    !files.slice(0, i).some((other) => isSameFile(other.entry, file.entry))
  );
}
