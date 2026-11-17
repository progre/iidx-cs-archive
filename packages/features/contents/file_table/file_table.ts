import { type FileTableDefinition, SEC } from "@csa/core";

/** アーカイブの中の1ファイル。indexはアーカイブの表の行、offsetとsizeはバイト数 */
export interface FileEntry {
  archive: string;
  index: number;
  offset: number;
  size: number;
}

/** ELFにある、アーカイブごとのファイル表 */
export class FileTable {
  private readonly view: DataView;

  constructor(elf: Uint8Array, private readonly def: FileTableDefinition) {
    this.view = new DataView(elf.buffer, elf.byteOffset, elf.byteLength);
  }

  /** archive番目のアーカイブが持つファイルの数 */
  count(archive: number): number {
    return this.archiveOf(archive).count;
  }

  entry(archive: number, index: number): FileEntry {
    const table = this.archiveOf(archive);
    if (!Number.isInteger(index) || index < 0 || index >= table.count) {
      throw new RangeError(
        `${table.fileName}の範囲外: ${index} / ${table.count}`,
      );
    }
    const { rowBytes, sizeIndex, sizeUnit } = this.def;
    const row = table.offset + index * rowBytes;
    return {
      archive: table.fileName,
      index,
      offset: this.view.getUint32(row, true) * SEC,
      size: this.view.getUint32(row + sizeIndex * 4, true) * sizeUnit,
    };
  }

  /** 全アーカイブの表をつないだ通し番号で引く */
  entryAt(serial: number): FileEntry {
    let index = serial;
    for (const [archive, table] of this.def.archives.entries()) {
      if (index < table.count) {
        return this.entry(archive, index);
      }
      index -= table.count;
    }
    throw new RangeError(`ファイル表の範囲外: ${serial}`);
  }

  private archiveOf(archive: number) {
    const table = this.def.archives[archive];
    if (table == null) {
      throw new RangeError(`アーカイブが無い: ${archive}`);
    }
    return table;
  }
}
