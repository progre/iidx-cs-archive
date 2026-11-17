// PBの原盤は、PBの周回で開き、ISO の書き込みと検証が終わってから閉じる。
// ISO を作る側は、原盤を開き直さずにここから読む。素材のバイト列は持たず、要る時に原盤から読む。

import type { DiscImage } from "@csa/core";
import type { DirEnt, Disc, Iso9660 } from "../volume/mod.ts";

// 周回で持ち帰る、原盤のファイル一覧と大きさ。
// 原盤を開き直さずに、素材の範囲の検査と、ファイルの位置の引き当てに使う。
export interface DiscInfo {
  files: ReadonlyMap<
    string,
    { lba: number; recordOffset: number; size: number }
  >;
  /** イメージ全体の大きさ */
  size: number;
}

export const discInfoOf = (
  { disc, files }: Disc & { files: ReadonlyMap<string, DirEnt> },
): DiscInfo => ({
  files,
  size: disc.size,
});

export class PbSource implements Disposable {
  readonly #disc: Iso9660;
  /** 原盤のファイル一覧とイメージ全体の大きさ */
  readonly info: DiscInfo;

  constructor(disc: Iso9660, info: DiscInfo) {
    this.#disc = disc;
    this.info = info;
  }

  /** 原盤全体の大きさ(バイト) */
  get size(): number {
    return this.#disc.size;
  }

  readAt(offset: number, length: number): Promise<Uint8Array> {
    return this.#disc.readAt(offset, length);
  }

  readInto(offset: number, buffer: Uint8Array): Promise<void> {
    return this.#disc.readInto(offset, buffer);
  }

  /** 複製などの`DiscImage`を受ける処理へ渡す見せ方。閉じても、原盤は閉じない */
  borrowedImage(): DiscImage {
    return {
      close: () => {},
      readAt: (offset, length) => this.readAt(offset, length),
      readInto: (offset, buffer) => this.readInto(offset, buffer),
      size: this.size,
      [Symbol.dispose]: () => {},
    };
  }

  [Symbol.dispose](): void {
    this.#disc.close();
  }
}
