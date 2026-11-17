// 鍵の並びが先にわかっているとき、同じ鍵の値を1度だけ作る。
// 値は、その鍵を最後に使うまでだけ持つ。原盤の同じ範囲を2度読まないために使う。

export class LaterUses<V> {
  readonly #left = new Map<string, number>();
  readonly #kept = new Map<string, V>();

  /** `keys`は、`take`を呼ぶ順の鍵の並び */
  constructor(keys: readonly string[]) {
    keys.forEach((key) => this.#left.set(key, (this.#left.get(key) ?? 0) + 1));
  }

  /** 持っている値を返す。持っていなければ`make`で作る */
  async take(key: string, make: () => Promise<V>): Promise<V> {
    const value = this.#kept.get(key) ?? await make();
    const left = (this.#left.get(key) ?? 1) - 1;
    this.#left.set(key, left);
    if (left > 0) {
      this.#kept.set(key, value);
    } else {
      this.#kept.delete(key);
    }
    return value;
  }

  /** 持っている値の数 */
  get keptCount(): number {
    return this.#kept.size;
  }
}
