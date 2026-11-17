// 世代の譜面をPB鍵で暗号化して並べたbundleを、ファイルを作らずに読めるようにする。
// 読む範囲に重なる譜面だけを、LZ済みの譜面から暗号化して返す。暗号化した譜面は直近の1件だけ覚える。

import type { DiscImage } from "@csa/core";
import {
  type LzChart,
  type PackedChartIndex,
  type PackedChartRow,
  packLzChart,
} from "../pack/mod.ts";

export class PackedChartImage implements DiscImage {
  readonly size: number;
  #last: { packed: Uint8Array; row: PackedChartRow } | undefined;

  /** `readLz`は、通し番号でLZ済みの譜面を読む */
  constructor(
    private readonly index: PackedChartIndex,
    private readonly readLz: (sourceFileIndex: number) => Uint8Array,
    private readonly key: Uint8Array,
  ) {
    this.size = index.bundleBytes;
  }

  readAt(offset: number, length: number): Promise<Uint8Array> {
    const bytes = new Uint8Array(length);
    return this.readInto(offset, bytes).then(() => bytes);
  }

  readInto(offset: number, buffer: Uint8Array): Promise<void> {
    if (offset < 0 || offset + buffer.length > this.size) {
      return Promise.reject(
        new Error(
          `譜面bundleの範囲外を読もうとした: ${offset}+${buffer.length}`,
        ),
      );
    }
    let done = 0;
    for (let i = this.#rowIndexAt(offset); done < buffer.length; i++) {
      const row = this.index.charts[i];
      const from = offset + done - row.offset;
      const count = Math.min(row.size - from, buffer.length - done);
      buffer.set(this.#packedOf(row).subarray(from, from + count), done);
      done += count;
    }
    return Promise.resolve();
  }

  close(): void {
    this.#last = undefined;
  }

  [Symbol.dispose](): void {
    this.close();
  }

  /** `offset`を含む譜面の行の位置。行はoffsetの昇順に並んでいる */
  #rowIndexAt(offset: number): number {
    let low = 0;
    let high = this.index.charts.length - 1;
    while (low < high) {
      const middle = (low + high + 1) >> 1;
      if (this.index.charts[middle].offset <= offset) {
        low = middle;
      } else {
        high = middle - 1;
      }
    }
    return low;
  }

  #packedOf(row: PackedChartRow): Uint8Array {
    if (this.#last?.row === row) {
      return this.#last.packed;
    }
    const lzChart: LzChart = {
      lz: this.readLz(row.sourceFileIndex),
      plainSize: row.plainSize,
      sourceFileIndex: row.sourceFileIndex,
    };
    const packed = packLzChart(lzChart, this.key);
    if (packed.length !== row.size) {
      throw new Error(
        `file ${row.sourceFileIndex}の暗号化後の長さ${packed.length}が計画${row.size}と違う`,
      );
    }
    this.#last = { packed, row };
    return packed;
  }
}
