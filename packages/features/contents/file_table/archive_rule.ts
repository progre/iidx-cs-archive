// 曲DBのファイル番号を、定義の規則でファイル表から引く。

import type { ArchiveRule } from "@csa/core";
import type { FileEntry, FileTable } from "./file_table.ts";

// ファイル表を引くのに要る、曲DBの1曲の欄。contents/song_db の SongDbRecord がこの形を満たす。

export interface FileFieldsRecord {
  readonly selection: { readonly origin: number | null };
  readonly video: {
    readonly primary: readonly number[];
    readonly secondary: readonly number[] | null;
    readonly secondaryArchive: number | null;
  };
  readonly overlay: { readonly file: number | null };
}

const ORIGIN_IN_SECOND_ARCHIVE = 2;

export function entryByRule(
  rule: ArchiveRule | null,
  value: number,
  record: FileFieldsRecord,
  table: FileTable,
): FileEntry {
  switch (rule) {
    case null:
      return table.entryAt(value);
    case "origin":
      return table.entry(
        record.selection.origin === ORIGIN_IN_SECOND_ARCHIVE ? 1 : 0,
        value,
      );
    case "overlap":
      return table.entry(value < table.count(1) ? 1 : 2, value);
  }
}
