/**
 * セーブモジュール#12(スコア変動)の自分の表を、CSAの曲数に広げる。
 * 原盤の表は自分1本とライバル5本で、どれも99曲分である。
 * CSAはライバルを使わず、自分の表をライバルの表の領域まで伸ばす。
 * モジュールの大きさとセーブの大きさは変わらない。
 */

import type { MutableElf } from "../../elf/mod.ts";
import { addiu, jr, move, NOP, reg, withImmediate } from "../mips/mod.ts";
import { verifyRivalMenu, writeRivalMenu } from "./rival_menu.ts";

/** 自分の表の、曲の記録を並べる配列の位置(モジュール先頭から)と1曲の大きさ */
const SELF_RECORDS = 0x8 + 0xc60e;
const RECORD_BYTES = 0x200;
/** ライバルの使用の印。自分の表はこの手前まで伸ばせる */
const RIVAL_FLAGS = 0x94874;
export const GHOST_TABLE_SONG_LIMIT = Math.floor(
  (RIVAL_FLAGS - SELF_RECORDS) / RECORD_BYTES,
);

export interface GhostTablePatch {
  address: number;
  csa: number;
}

/** 関数の先頭の2語を、`delay`を遅延スロットに置いた`jr ra`にする */
const returnWith = (address: number, delay: number): GhostTablePatch[] => [
  { address, csa: jr(reg.ra) },
  { address: address + 4, csa: delay },
];

/** 自分の表を初期化するループの上限を比べる命令 */
const INIT_LIMIT_ADDRESS = 0x173634;

/**
 * 書き換える語。ループの上限は、`wordAt`で読んだ命令の即値だけを曲数にする。
 * 原盤であることは、呼び出し側がELF全体のハッシュで確かめている
 */
export function ghostTablePatches(
  songCount: number,
  wordAt: (address: number) => number,
): GhostTablePatch[] {
  if (songCount > GHOST_TABLE_SONG_LIMIT) {
    throw new Error(
      `スコア変動の表に入る曲数は${GHOST_TABLE_SONG_LIMIT}曲まで: ${songCount}曲`,
    );
  }
  return [
    // ライバルの表を返す関数は、自分の表(モジュール+8)を返す
    ...returnWith(0x1736b0, addiu(reg.v0, reg.a0, 8)),
    // ライバルを使っているかは、常に使っていないと答える
    ...returnWith(0x173cb0, move(reg.v0, reg.zero)),
    // ライバルの取り込みと削除は何もしない。
    // ライバルの表の領域には、伸ばした自分の表が入っている
    ...returnWith(0x173b50, NOP),
    ...returnWith(0x173ad0, NOP),
    // 自分の表を伸ばすと、ライバルの表の末尾3バイトは曲の記録と重なる。この3バイトは、ライバルの画面しか読まない
    ...returnWith(0x173020, NOP),
    // 初期化は、ライバルの表5本を初期化しない
    { address: 0x173d3c, csa: NOP },
    {
      address: INIT_LIMIT_ADDRESS,
      csa: withImmediate(wordAt(INIT_LIMIT_ADDRESS), songCount),
    },
  ];
}

export function writeGhostTable(elf: MutableElf, songCount: number): void {
  const patches = ghostTablePatches(songCount, (address) => elf.u32(address));
  for (const patch of patches) {
    elf.setU32(patch.address, patch.csa);
  }
  writeRivalMenu(elf);
}

export function verifyGhostTable(elf: MutableElf, songCount: number): void {
  const wrong = ghostTablePatches(songCount, (address) => elf.u32(address))
    .filter((patch) => elf.u32(patch.address) !== patch.csa)
    .map((patch) => "0x" + patch.address.toString(16));
  if (wrong.length > 0) {
    throw new Error(`スコア変動の表の書き換えが違う: ${wrong.join(", ")}`);
  }
  verifyRivalMenu(elf);
}
