// 曲名順に使う題名を決めて書く処理が使う、他の feature の値と関数。実装は app が渡す。

export interface SortTitlePorts {
  /** 曲が全曲リストに書かれた行。行番号を持たない曲は`undefined`を返す */
  catalogRowAt(
    generation: string,
    line: number | undefined,
  ): { edition?: string | null; indexTitle: string | null } | undefined;
  /** 作品の並び。後の作品ほど後ろにある */
  generations: readonly string[];
  /** 曲DBのエントリー(符号化済み)の題名 */
  titleOf(entry: string): string;
  /** 曲DBのエントリー(符号化済み)の題名を書き換えた写し */
  withTitle(entry: string, title: string): string;
}
