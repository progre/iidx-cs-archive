/**
 * セーブモジュール#3(カスタマイズ)と#11(ギャラリー)を、初期化の時点で全解禁にする。
 * どちらの初期化も先頭で自分の領域をmemsetで0にするので、その呼び出しを
 * stubへ向け、memsetの後で解禁状態を書く。
 */

import {
  type InstructionPatch,
  type MutableElf,
  requireWord,
} from "../../../../elf/mod.ts";
import {
  addiu,
  assemble,
  bne,
  branchTo,
  daddu,
  j,
  jal,
  jr,
  ld,
  mark,
  NOP,
  type Piece,
  reg,
  sd,
  slti,
} from "../../../mips/mod.ts";
import { assert, hex } from "../common.ts";
import { UNLOCK_LIST_ACTION } from "./list.ts";

const MEMSET = 0x12af00;
/** カスタマイズの項目を1つ解禁する`(this, カテゴリ, 項目)`。全項目が揃うとRANDOMも立てる */
const UNLOCK_ITEM = 0x193c70;
/** カテゴリごとの実項目数。`UNLOCK_ITEM`が分岐する項目数と同じ */
const ITEM_COUNTS = [7, 0x24, 9, 9, 0x13, 4] as const;
/** memsetの呼び出し。引数の`this + 4`を、呼び出しと同時に用意する */
const CUSTOMIZE_MEMSET_CALL = 0x19339c;
/** memsetへの分岐。長さ`0xc8`、`this + 4`、値0を、分岐と同時に用意する */
const GALLERY_MEMSET_JUMP = 0x193268;
/** ギャラリーの解禁bit集合と閲覧済みbit集合。後ろの計数は0のまま残す */
const GALLERY_FLAG_BYTES = 0xb8;
const FILLED = 0xff;

function customizeStub(): Piece[] {
  const frame = 0x30;
  const categoryLoops = ITEM_COUNTS.flatMap((count, category) => [
    daddu(reg.s1, reg.zero, reg.zero),
    mark(`category${category}`),
    daddu(reg.a0, reg.s0, reg.zero),
    addiu(reg.a1, reg.zero, category),
    jal(UNLOCK_ITEM),
    daddu(reg.a2, reg.s1, reg.zero),
    addiu(reg.s1, reg.s1, 1),
    slti(reg.at, reg.s1, count),
    branchTo(bne(reg.at, reg.zero, 0), `category${category}`),
    NOP,
  ]);
  return [
    addiu(reg.sp, reg.sp, -frame),
    sd(reg.ra, 0x20, reg.sp),
    sd(reg.s1, 0x10, reg.sp),
    sd(reg.s0, 0, reg.sp),
    jal(MEMSET),
    addiu(reg.s0, reg.a0, -4),
    ...categoryLoops,
    ld(reg.ra, 0x20, reg.sp),
    ld(reg.s1, 0x10, reg.sp),
    ld(reg.s0, 0, reg.sp),
    jr(reg.ra),
    addiu(reg.sp, reg.sp, frame),
  ];
}

function galleryStub(): Piece[] {
  const frame = 0x20;
  return [
    addiu(reg.sp, reg.sp, -frame),
    sd(reg.ra, 0x10, reg.sp),
    jal(MEMSET),
    sd(reg.a0, 0, reg.sp),
    ld(reg.a0, 0, reg.sp),
    addiu(reg.a1, reg.zero, FILLED),
    jal(MEMSET),
    addiu(reg.a2, reg.zero, GALLERY_FLAG_BYTES),
    ld(reg.ra, 0x10, reg.sp),
    jr(reg.ra),
    addiu(reg.sp, reg.sp, frame),
  ];
}

export type ModuleUnlock = Readonly<{
  patches: readonly InstructionPatch[];
  words: readonly number[];
}>;

/** stubを`base`から置いたときの命令語と、初期化の呼び出しの差し替え */
export function buildModuleUnlock(
  elf: MutableElf,
  base: number,
): ModuleUnlock {
  const customize = assemble(customizeStub());
  const gallery = assemble(galleryStub());
  const galleryBase = base + customize.length * 4;
  const redirect = (
    address: number,
    expected: number,
    newWord: number,
    target: number,
    name: string,
  ): InstructionPatch => {
    const oldWord = requireWord(elf, address);
    assert(oldWord === expected, `${name}の初期化がmemsetを呼んでいない`);
    return {
      action: UNLOCK_LIST_ACTION,
      address,
      functionName: "",
      newReference: hex(target),
      newWord,
      oldReference: hex(MEMSET),
      oldWord,
      rationale: `${name}の初期化の後で全項目を解禁する`,
      referenceForm: "call",
      sourceAddress: hex(address),
      usage: "unlock_module",
    };
  };
  return {
    patches: [
      redirect(
        CUSTOMIZE_MEMSET_CALL,
        jal(MEMSET),
        jal(base),
        base,
        "カスタマイズ",
      ),
      redirect(
        GALLERY_MEMSET_JUMP,
        j(MEMSET),
        j(galleryBase),
        galleryBase,
        "ギャラリー",
      ),
    ],
    words: [...customize, ...gallery],
  };
}
