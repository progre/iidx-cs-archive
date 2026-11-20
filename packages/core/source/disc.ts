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

/** アーカイブの中の位置を、原盤の先頭からの位置にする。アーカイブが無いものは、並べ替えで最後に回す */
export const discOffsetOf = (
  files: ReadonlyMap<string, { lba: number }>,
  archive: string,
  offset: number,
): number => {
  const found = files.get(archive.toUpperCase().split(";")[0]);
  return found === undefined
    ? Number.MAX_SAFE_INTEGER
    : found.lba * SEC + offset;
};

/**
 * 読む対象を、原盤の上の位置の順に並べる。
 * 物理ドライブは遠くへのシークが遅いので、同じ作業の中では手前から順に読む
 */
export const inDiscOrder = <T>(
  items: readonly T[],
  offsetOf: (item: T) => number,
): T[] => items.toSorted((a, b) => offsetOf(a) - offsetOf(b));

/** 位置の順に読んで作った表を、元の並びに戻す。`keys`に無いキーは、後ろに今の順で残す */
export function inKeyOrder<K, V>(
  map: ReadonlyMap<K, V>,
  keys: Iterable<K>,
): Map<K, V> {
  const ordered = new Map<K, V>();
  for (const key of keys) {
    const value = map.get(key);
    if (value !== undefined && !ordered.has(key)) {
      ordered.set(key, value);
    }
  }
  for (const [key, value] of map) {
    if (!ordered.has(key)) {
      ordered.set(key, value);
    }
  }
  return ordered;
}
