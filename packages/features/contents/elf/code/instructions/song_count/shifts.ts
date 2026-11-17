/**
 * 選曲の特殊値を曲数ぶんずらす命令の一覧。
 * 閉フォルダー・ランダムなどの項目値は原盤の曲数の直後に並ぶので、曲数が増えた差だけ
 * 即値を動かす。`delta`は曲1つあたりの動き幅で、負の値は「値-曲数」を作る形を指す。
 */

export interface ShiftSite {
  address: number;
  delta: number;
}

/** 候補曲indexリストの埋戻し上限。曲数+1になる。 */
export const FILL_LIMIT_SITES: readonly number[] = [0x210e00, 0x210e28];

export const SHIFT_SITES: readonly ShiftSite[] = [
  { address: 0x1869f8, delta: 1 },
  { address: 0x186aa8, delta: 1 },
  { address: 0x186cb4, delta: 1 },
  { address: 0x1874a0, delta: 1 },
  { address: 0x18887c, delta: 1 },
  { address: 0x18892c, delta: 1 },
  { address: 0x188f4c, delta: 1 },
  { address: 0x189230, delta: 1 },
  { address: 0x18942c, delta: -1 },
  { address: 0x189454, delta: -1 },
  { address: 0x189a14, delta: 1 },
  { address: 0x189b6c, delta: 1 },
  { address: 0x189cac, delta: 1 },
  { address: 0x189ccc, delta: 1 },
  { address: 0x189d08, delta: 1 },
  { address: 0x189e14, delta: 1 },
  { address: 0x189ea4, delta: -1 },
  { address: 0x189f14, delta: 1 },
  { address: 0x18a5b0, delta: 1 },
  { address: 0x18a5bc, delta: 1 },
  { address: 0x18a5c4, delta: 1 },
  { address: 0x18b71c, delta: 1 },
  { address: 0x18c3c4, delta: 1 },
  { address: 0x18c458, delta: 1 },
  { address: 0x18c4bc, delta: 1 },
  { address: 0x18c544, delta: 1 },
  { address: 0x18c610, delta: 1 },
  { address: 0x18c820, delta: 1 },
  { address: 0x18c8d4, delta: 1 },
  { address: 0x18c93c, delta: 1 },
  { address: 0x18d7bc, delta: 1 },
  { address: 0x18d858, delta: 1 },
  { address: 0x18de34, delta: 1 },
  { address: 0x18fa78, delta: -1 },
  { address: 0x18faa0, delta: 1 },
  { address: 0x18faa4, delta: 1 },
  { address: 0x1d8cdc, delta: 1 },
  { address: 0x1d8cec, delta: 1 },
  { address: 0x1d8f08, delta: 1 },
  { address: 0x1d8fa0, delta: 1 },
  { address: 0x1d8fac, delta: 1 },
  { address: 0x1d8fb8, delta: 1 },
  // 特殊アイコンの配列は値+1でずれるので、基底を4バイト×曲数ぶん戻す
  { address: 0x1d8fcc, delta: -4 },
  { address: 0x1d9284, delta: 1 },
  { address: 0x1d9294, delta: 1 },
  { address: 0x1d937c, delta: 1 },
  { address: 0x1d93b0, delta: 1 },
  { address: 0x1d93bc, delta: 1 },
  { address: 0x1d93c8, delta: 1 },
  { address: 0x1d93dc, delta: -4 },
  { address: 0x1d9fa0, delta: 1 },
  { address: 0x1dabc0, delta: 1 },
];
