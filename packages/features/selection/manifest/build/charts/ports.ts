// 表の曲に無い難易度の出し方を決める処理が使う、他の feature の値と関数。実装は app が渡す。

export interface ChartPorts {
  /** PB の譜面の枠の難易度名。並びは曲DBの譜面の欄の順 */
  chartSlots: readonly string[];
  /** 作品の並び。後の作品ほど後ろにある */
  generations: readonly string[];
  /** 曲DBのエントリー(符号化済み)から、難易度のレベルを符号付きで読む */
  levelOf(entry: string, name: string): number;
  /** PB原盤の世代名 */
  pbGeneration: string;
}
