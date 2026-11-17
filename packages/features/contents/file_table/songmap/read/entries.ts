// 通し番号で引くファイルの一覧。曲DBの参照を、素材名で各ファイルに書き込む。

import type { FileTable } from "../../file_table.ts";

export interface Reference {
  songId: number;
  name: string;
}

export interface Entry {
  archive: string;
  offset: number;
  size: number;
  refs: Reference[];
}

export class Entries {
  readonly list: Entry[];
  private readonly bases = new Map<number, number>();
  private readonly counts = new Map<number, number>();

  /** nameOfは、定義のアーカイブ名を一覧に書く表記へ直す */
  constructor(
    table: FileTable,
    order: readonly number[],
    private readonly nameOf: (name: string) => string,
  ) {
    this.list = [];
    for (const archive of order) {
      this.bases.set(archive, this.list.length);
      this.list.push(...this.rowsOf(table, archive));
    }
  }

  private rowsOf(table: FileTable, archive: number): Entry[] {
    const count = table.count(archive);
    this.counts.set(archive, count);
    return Array.from({ length: count }, (_, index) => {
      const { archive: name, offset, size } = table.entry(archive, index);
      return { archive: this.nameOf(name), offset, size, refs: [] };
    });
  }

  countOf(archive: number): number {
    return this.counts.get(archive) ?? 0;
  }

  /** archive番目のアーカイブの先頭の通し番号 */
  baseOf(archive: number): number {
    const base = this.bases.get(archive);
    if (base == null) {
      throw new RangeError(`通し番号に含まれないアーカイブ: ${archive}`);
    }
    return base;
  }

  append(entry: Entry): number {
    return this.list.push(entry) - 1;
  }

  refer(serial: number, reference: Reference): void {
    const entry = this.list[serial];
    if (entry == null) {
      throw new RangeError(`ファイルの範囲外: ${serial} / ${this.list.length}`);
    }
    entry.refs.push(reference);
  }
}
