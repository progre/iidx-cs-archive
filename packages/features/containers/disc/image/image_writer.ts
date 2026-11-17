// 出力イメージを先頭から順に書き進める。進んだ量を1GBごとに報告する。

import type { DiscImage } from "@csa/core";

/** 出力イメージの書き込み先。`seek`で書く位置を移し、`write`はその位置から書く */
export interface ImageSink {
  seek(offset: number): Promise<void>;
  write(data: Uint8Array): Promise<void>;
  close(): void;
}

const CHUNK = 32 * 1024 * 1024;
const PROGRESS_STEP = 1024 * 1024 * 1024;

export class ImageWriter {
  position = 0;
  #reported = 0;
  #copyBuffer: Uint8Array | null = null;

  constructor(
    private readonly sink: ImageSink,
    private readonly log: (line: string) => void,
  ) {}

  async bytes(data: Uint8Array): Promise<void> {
    await this.sink.write(data);
    this.position += data.length;
    this.#report();
  }

  async copy(from: DiscImage, offset: number, length: number): Promise<void> {
    this.#copyBuffer ??= new Uint8Array(CHUNK);
    for (let copied = 0; copied < length; copied += CHUNK) {
      const chunk = this.#copyBuffer.subarray(
        0,
        Math.min(CHUNK, length - copied),
      );
      await from.readInto(offset + copied, chunk);
      await this.bytes(chunk);
    }
  }

  /** 書き終えた範囲の上へ写す。書込み位置は元へ戻す */
  async copyOver(
    target: number,
    from: DiscImage,
    offset: number,
    length: number,
  ): Promise<void> {
    const resume = this.position;
    if (target + length > resume) {
      throw new Error(`上書きの範囲${target}+${length}が書込み位置を超える`);
    }
    await this.sink.seek(target);
    this.position = target;
    await this.copy(from, offset, length);
    await this.sink.seek(resume);
    this.position = resume;
  }

  async padTo(target: number): Promise<void> {
    if (target < this.position) {
      throw new Error(`書込み位置${this.position}が目標${target}を超えている`);
    }
    const zero = new Uint8Array(Math.min(CHUNK, target - this.position));
    while (this.position < target) {
      await this.bytes(
        zero.subarray(0, Math.min(zero.length, target - this.position)),
      );
    }
  }

  #report(): void {
    if (this.position - this.#reported < PROGRESS_STEP) return;
    this.#reported = this.position;
    this.log(`  written ${(this.position / 1e9).toFixed(1)} GB...`);
  }
}
