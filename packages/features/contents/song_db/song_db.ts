import type { ElfDefinition } from "@csa/core";
import { SongDbRecord } from "./record/mod.ts";

export class SongDb {
  constructor(
    private readonly elf: Uint8Array,
    private readonly def: ElfDefinition,
  ) {}

  get length(): number {
    return this.def.songDbRecordCount;
  }

  /** レコードはELFをコピーせず、ビューで持つ */
  record(index: number): SongDbRecord {
    return new SongDbRecord(this.bytesOf(index), this.def, this.elf);
  }

  /** `index`番目のレコードのバイト列。ELFをコピーせず、ビューで返す */
  bytesOf(index: number): Uint8Array {
    const start = this.offsetOf(index);
    return this.elf.subarray(start, start + this.def.songDbRecordLength);
  }

  /**
   * `index`番目のレコードの、ELFの中での位置。
   * 曲DBの終端の位置も求められるように、`index`には`length`も渡せる
   */
  offsetOf(index: number): number {
    if (!Number.isInteger(index) || index < 0 || index > this.length) {
      throw new RangeError(`曲DBの範囲外: ${index} / ${this.length}`);
    }
    return this.def.songDbBase + index * this.def.songDbRecordLength;
  }

  /** 曲番号と曲名の一覧。全曲リストの処理で使う */
  songTitles(): { songId: number; title: string }[] {
    return Array.from(
      { length: this.length },
      (_, songId) => ({ songId, title: this.record(songId).title.text }),
    );
  }
}
