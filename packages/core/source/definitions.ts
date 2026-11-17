import type { SongDbRecordLayout } from "./song_db_record.ts";

export type * from "./song_db_record.ts";

/** ELFにある、1つのアーカイブのファイル表 */
export interface ArchiveTable {
  /** ISOの中のアーカイブのファイル名 */
  fileName: string;
  /** 表のELFファイル内の位置 */
  offset: number;
  count: number;
}

/** 行の先頭のu32がアーカイブ内の位置(セクター) */
export interface FileTableDefinition {
  /** 7thの`+0x40`が選ぶ番号の順(A・B・C) */
  archives: ArchiveTable[];
  rowBytes: number;
  /** 大きさが行の何番目のu32か */
  sizeIndex: number;
  /** 大きさの1単位のバイト数 */
  sizeUnit: number;
}

export interface ElfDefinition {
  fileName: string;
  songDbBase: number;
  songDbRecordCount: number;
  songDbRecordLength: number;
  /** 仮想アドレスからELFファイル内の位置を得るために引く値 */
  pointerBase: number;
  fileTable: FileTableDefinition;
  songDbRecordLayout: SongDbRecordLayout;
}
