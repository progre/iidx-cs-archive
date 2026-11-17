/**
 * ラベル付きの命令列を配列で書くための組み立て器。
 * 分岐命令の遅延スロットは呼び手が置く。
 */

import { beq, NOP, reg } from "./encode.ts";

class LabelMarkToken {
  constructor(readonly label: string) {}
}

class LabelBranchToken {
  constructor(readonly word: number, readonly label: string) {}
}

/** ここにラベルを置く。語は生まない。 */
export type LabelMark = LabelMarkToken;

/** 分岐命令を飛び先のラベル付きで置く。 */
export type LabelBranch = LabelBranchToken;

/** 命令語か、ラベルの印。`assemble`が平坦化して相対offsetを埋める。 */
export type Piece = number | LabelMark | LabelBranch;

/** ここにラベルを置く。語は生まない。 */
export function mark(label: string): LabelMark {
  return new LabelMarkToken(label);
}

/** 分岐命令を飛び先のラベル付きで置く。`word`の下位16bitは無視される。 */
export function branchTo(word: number, label: string): LabelBranch {
  return new LabelBranchToken(word, label);
}

/** 条件無しの分岐と、その遅延スロットのNOP。 */
export function always(label: string): Piece[] {
  return [branchTo(beq(reg.zero, reg.zero, 0), label), NOP];
}

/** 並びを語の配列にする。 */
export function assemble(pieces: readonly Piece[]): number[] {
  const out: number[] = [];
  const labels = new Map<string, number>();
  const fixes: { at: number; label: string }[] = [];

  for (const piece of pieces) {
    if (piece instanceof LabelMarkToken) {
      if (labels.has(piece.label)) {
        throw new Error(`ラベルが重複: ${piece.label}`);
      }
      labels.set(piece.label, out.length);
      continue;
    }
    if (piece instanceof LabelBranchToken) {
      fixes.push({ at: out.length, label: piece.label });
      out.push(piece.word);
      continue;
    }
    out.push(piece);
  }

  for (const { at, label } of fixes) {
    const target = labels.get(label);
    if (target === undefined) throw new Error(`ラベルが無い: ${label}`);
    const offset = target - (at + 1);
    if (offset < -0x8000 || offset > 0x7fff) {
      throw new Error(`分岐が届かない: ${label}`);
    }
    out[at] = ((out[at] & 0xffff0000) | (offset & 0xffff)) >>> 0;
  }

  return out;
}
