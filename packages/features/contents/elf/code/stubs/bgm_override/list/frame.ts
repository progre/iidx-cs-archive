// 全曲リストで足した組のstubの足場。フレームの割り当てと、呼ぶ原作の関数。

import { PB } from "../parts.ts";

/** CSAの曲DBの位置。ビルドが決める */
export interface SongDbAddress {
  recordLength: number;
  vaddr: number;
}

/** 原作が持つ関数 */
export const CALL = {
  /** パッドワーク`+0x10a`のボタン語 */
  buttons: 0x13a960,
  /** 選んだ難易度。0=NORMAL 1=HYPER 2=ANOTHER 3=BEGINNER 4=黒ANOTHER */
  difficulty: 0x202190,
  /** パッドワーク`+0x163`。下か RIGHT を押し続けている間 1 */
  down: PB.directionA,
  /** `side(playerOf())`が今の側 */
  playerOf: 0x167d20,
  side: 0x192000,
  /** 側 → 0=SP 1=DP 3=それ以外 */
  style: 0x1d6070,
  /** パッドワーク`+0x161`。上か LEFT を押し続けている間 1 */
  up: PB.directionB,
} as const;

/** ボタン語の L1・R1 のビット。ボタン語の並びからの推定 */
export const BUTTON = { l1: 0x04, r1: 0x08 } as const;

/** 曲DBのエントリーのレベル欄。`+0x4a + style*5 + rank` */
export const LEVELS = 0x4a;

/** `CALL.difficulty`の値の順 */
const RANKS = ["normal", "hyper", "another", "beginner", "black"];

/** `sp_black`の形の難易度名から、レベル欄の並びの番号`style*5 + rank`を引く */
export function levelIndexOf(name: string): number {
  const [style, rank] = name.split("_");
  const styleIndex = ["sp", "dp"].indexOf(style);
  const rankIndex = RANKS.indexOf(rank);
  if (styleIndex < 0 || rankIndex < 0) {
    throw new Error(`未知の難易度名: ${name}`);
  }
  return styleIndex * RANKS.length + rankIndex;
}

export const FRAME = 0x60;

/** フレームに置く値。jalをまたぐとt/aレジスタは壊れるので、ここへ退避する */
export const SLOT = {
  current: 0x10,
  row: 0x14,
  result: 0x18,
  rank: 0x1c,
  levelOffset: 0x20,
  candidates: 0x24,
  select: 0x28,
  up: 0x2c,
  down: 0x30,
  buttons: 0x34,
  /** 裏ごとに、候補なら1。`MAX_BACKS`語 */
  flags: 0x38,
  ra: 0x5c,
} as const;

/** 原作の組のstubへ飛ぶ位置、結果を書く位置、戻る位置、選び方の入口 */
export const LABEL = {
  done: "done",
  forced: "forced",
  pass: "pass",
  random: "random",
  select: "select",
  write: "write",
} as const;
