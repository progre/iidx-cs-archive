// 上書き曲indexを書くstub。
// `0x1f2140`から呼ばれる。
// `0x1f2140`は、原作empが分岐を持っていた位置である。
// PBでは、この位置に使われない呼び出しだけが残っている。
// 表を引いて規則を評価する。
// gp`-0x7d9c`へ裏の曲indexを書く。

import {
  addiu,
  always,
  assemble,
  beq,
  bltz,
  bne,
  branchTo,
  jal,
  jr,
  lw,
  mark,
  NOP,
  pairWords,
  type Piece,
  reg,
  sw,
} from "../../mips/mod.ts";
import {
  bothSides,
  DONE,
  FRAME,
  PB,
  SLOT,
  WRITE,
  writeOverride,
} from "./parts.ts";
import { alternateRule, alwaysRule, randomRule, tripleRule } from "./rules.ts";
import { fieldOffset, ROW_SIZE, RULE, VARIANT_TABLE } from "./table.ts";

const RULE_LABELS: [number, string][] = [
  [RULE.always, "ruleAlways"],
  [RULE.alternate, "ruleAlternate"],
  [RULE.random, "ruleRandom"],
];
const TRIPLE_LABEL = "ruleTriple";

/** モード判定がどちらも0のときだけ続ける(原作empの条件) */
const modeGate = (): Piece[] =>
  [PB.modeA, PB.modeB].flatMap((target) => [
    jal(target),
    NOP,
    branchTo(bne(reg.v0, reg.zero, 0), DONE),
    NOP,
  ]);

/**
 * 現在曲で表を引き、見つかった行を`t0`に残す。走査しながら、その曲が行の`trigger`なら
 * 印を立てる(djtの「直前にこの曲を演奏した」)。同じ曲が別の行の差し替え元でもある組は
 * 無いので、見つけた時点で走査を終える。
 */
function scan(): Piece[] {
  const next = "scan";
  const check = "scanCheck";
  const found = "found";
  return [
    jal(PB.songIndex),
    NOP,
    sw(reg.v0, SLOT.current, reg.sp),
    ...pairWords(reg.t0, VARIANT_TABLE),
    mark(next),
    lw(reg.t1, fieldOffset("front"), reg.t0),
    branchTo(bltz(reg.t1, 0), DONE),
    NOP,
    lw(reg.t2, SLOT.current, reg.sp),
    lw(reg.t3, fieldOffset("trigger"), reg.t0),
    branchTo(bne(reg.t3, reg.t2, 0), check),
    NOP,
    addiu(reg.t4, reg.zero, 1),
    sw(reg.t4, fieldOffset("state"), reg.t0),
    mark(check),
    branchTo(beq(reg.t1, reg.t2, 0), found),
    NOP,
    addiu(reg.t0, reg.t0, ROW_SIZE),
    ...always(next),
    mark(found),
  ];
}

const dispatch = (): Piece[] => [
  ...RULE_LABELS.flatMap(([value, label]) => [
    addiu(reg.t4, reg.zero, value),
    branchTo(beq(reg.t3, reg.t4, 0), label),
    NOP,
  ]),
  ...always(TRIPLE_LABEL),
];

export function bgmOverrideStubWords(): number[] {
  return assemble([
    addiu(reg.sp, reg.sp, -FRAME),
    sw(reg.ra, SLOT.ra, reg.sp),
    ...modeGate(),
    ...scan(),
    sw(reg.t0, SLOT.row, reg.sp),
    addiu(reg.t1, reg.zero, -1),
    sw(reg.t1, SLOT.result, reg.sp),
    ...bothSides(PB.selectPressed, SLOT.select),
    lw(reg.t0, SLOT.row, reg.sp),
    lw(reg.t3, fieldOffset("rule"), reg.t0),
    ...dispatch(),
    ...alwaysRule(RULE_LABELS[0][1]),
    ...alternateRule(RULE_LABELS[1][1]),
    ...randomRule(RULE_LABELS[2][1]),
    ...tripleRule(TRIPLE_LABEL),
    mark(WRITE),
    lw(reg.t1, SLOT.result, reg.sp),
    branchTo(bltz(reg.t1, 0), DONE),
    NOP,
    ...writeOverride(SLOT.current),
    mark(DONE),
    lw(reg.ra, SLOT.ra, reg.sp),
    addiu(reg.sp, reg.sp, FRAME),
    jr(reg.ra),
    NOP,
  ]);
}
