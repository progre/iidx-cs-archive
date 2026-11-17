// 全曲リストの行から収録の指定を作るときに、app から受け取る処理。

import type { Chart } from "@csa/core";

export interface ListingPorts {
  /** 譜面の列名を、曲DBの難易度名にする */
  difficultyNamesOf: (charts: readonly Chart[]) => string[];
  /** `songId`が原作の5鍵盤版なら、その表の曲の曲番号を返す。5鍵盤版でなければ`undefined`を返す */
  fiveKeyOf: (generation: string, songId: number) => number | undefined;
}
