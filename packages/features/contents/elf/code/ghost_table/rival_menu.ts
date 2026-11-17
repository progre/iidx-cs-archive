/**
 * ライバルの画面のメニュー(`FUN_001a0860`)で、ライバルの一覧を編集する2項目を決定できなくする。
 * 項目は上から0〜2で、2が名前の変更である。カーソルは原盤どおり動く。
 * 決定ボタンが押されたかを調べる関数の呼び出しをstubへ向ける。
 * stubは、カーソルが名前の変更でなければ、押されていないと返す。
 */

import type { MutableElf } from "../../elf/mod.ts";
import { STUB_SLOTS } from "../../data/stub_area/mod.ts";
import {
  addiu,
  assemble,
  bne,
  branchTo,
  j,
  jr,
  lw,
  mark,
  move,
  NOP,
  reg,
} from "../mips/mod.ts";
import { writeSlot } from "../stubs/mod.ts";

/** 決定ボタンが押されたかを返す関数と、メニューがそれを呼ぶ位置 */
const IS_DECIDED = 0x130490;
const CALL = { address: 0x1a10a4, pb: j(IS_DECIDED, true) };
/** 画面の状態を指すgpからの位置と、状態の中のカーソルの位置 */
const STATE_FROM_GP = -0x7898;
const CURSOR = 0x14;
const RENAME_ITEM = 2;

const SLOT = STUB_SLOTS.rivalMenuCode;

export function rivalMenuStub(): number[] {
  return assemble([
    lw(reg.v1, STATE_FROM_GP, reg.gp),
    lw(reg.v1, CURSOR, reg.v1),
    addiu(reg.v1, reg.v1, -RENAME_ITEM),
    branchTo(bne(reg.v1, reg.zero, 0), "ignore"),
    NOP,
    j(IS_DECIDED),
    NOP,
    mark("ignore"),
    jr(reg.ra),
    move(reg.v0, reg.zero),
  ]);
}

export function writeRivalMenu(elf: MutableElf): void {
  if (elf.u32(CALL.address) !== CALL.pb) {
    throw new Error("ライバルのメニューの決定の判定が原盤の命令でない");
  }
  writeSlot(elf, SLOT, rivalMenuStub());
  elf.setU32(CALL.address, j(SLOT.vaddr, true));
}

export function verifyRivalMenu(elf: MutableElf): void {
  const stub = rivalMenuStub();
  const stubMatches = stub.every((word, index) =>
    elf.u32(SLOT.vaddr + index * 4) === word
  );
  if (!stubMatches || elf.u32(CALL.address) !== j(SLOT.vaddr, true)) {
    throw new Error("ライバルのメニューの書き換えが違う");
  }
}
