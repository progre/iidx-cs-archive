// 世代の実行ファイルは、世代ごとに1回だけ読み、その世代の処理を終えたら手放す。
// 世代をまたぐ並びは、世代ごとにまとめて引く。

/** 直前に引いた世代の値だけ持つ。別の世代を引いたら、前の世代の値を手放して作り直す */
export function forCurrentGeneration<T>(
  make: (generation: string) => T,
): (generation: string) => T {
  let current: { generation: string; value: T } | undefined;
  return (generation) => {
    if (current?.generation !== generation) {
      current = { generation, value: make(generation) };
    }
    return current.value;
  };
}

// 世代の実行ファイルは呼ぶたびにファイルから読むので、世代をまたぐ並びは世代ごとにまとめて処理する。

/** `items`の添字を、世代ごとにまとめた順で返す。世代の中では元の並びを保つ */
export function indicesByGeneration<T>(
  items: readonly T[],
  generationOf: (item: T) => string,
): number[] {
  const indicesOf = new Map<string, number[]>();
  items.forEach((item, index) => {
    const generation = generationOf(item);
    const indices = indicesOf.get(generation) ?? [];
    indices.push(index);
    indicesOf.set(generation, indices);
  });
  return [...indicesOf.values()].flat();
}

/** 世代ごとにまとめた順で`make`を呼び、結果は`items`の並びで返す */
export function mapByGeneration<T, R>(
  items: readonly T[],
  generationOf: (item: T) => string,
  make: (item: T, index: number) => R,
): R[] {
  const results = new Array<R>(items.length);
  for (const index of indicesByGeneration(items, generationOf)) {
    results[index] = make(items[index], index);
  }
  return results;
}
