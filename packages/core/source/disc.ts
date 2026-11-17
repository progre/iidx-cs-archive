/**
 * 組を持たない曲1件。`songIndex`は曲DB indexである。
 * `descriptorOffset`は、その曲の記述子がELFのどこにあるかを、file offsetで示す
 */
export interface PairlessSourceSong {
  descriptorOffset: number;
  songIndex: number;
}

// 原盤のバイト列を読む口。イメージファイルや物理ディスクなど、読み方の違いはこの型の裏に隠す。
// 世代のIDから値を作る処理は、`app`が持つ。

export interface DiscImage {
  /** 原盤の大きさ(バイト) */
  readonly size: number;
  readAt(offset: number, length: number): Promise<Uint8Array>;
  /** `buffer`の長さ分を読み、`buffer`へ書く。長い範囲をコピーするとき、同じバッファーを使い回せる */
  readInto(offset: number, buffer: Uint8Array): Promise<void>;
  close(): void;
  [Symbol.dispose](): void;
}

export const SEC = 2048;

/** 開いてある原盤のうち、読むのに使う部分 */
export interface OpenDisc {
  disc: { readAt(offset: number, length: number): Promise<Uint8Array> };
  /** アーカイブのファイル名(大文字) → 位置と大きさ */
  files: ReadonlyMap<string, { lba: number; size: number }>;
}
