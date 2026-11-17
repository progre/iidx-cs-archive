/** 分岐・ジャンプの判別と飛び先。遅延スロットの扱いは呼び手が持つ。 */

import { immOf, opOf, rsOf } from "./fields.ts";

const BRANCH_OPS = new Set([0x04, 0x05, 0x06, 0x07, 0x14, 0x15, 0x16, 0x17]);
const LIKELY_OPS = new Set([0x14, 0x15, 0x16, 0x17]);

export function isBranch(word: number): boolean {
  const op = opOf(word);
  return BRANCH_OPS.has(op) || op === 0x01 ||
    (op === 0x11 && rsOf(word) === 0x08);
}

export function isLikely(word: number): boolean {
  const op = opOf(word);
  if (LIKELY_OPS.has(op)) return true;
  if (op === 0x01 || op === 0x11) return ((word >>> 16) & 2) !== 0;
  return false;
}

export function isJump(word: number): boolean {
  const op = opOf(word), fn = word & 0x3f;
  return op === 0x02 || op === 0x03 ||
    (op === 0 && (fn === 0x08 || fn === 0x09));
}

export const isControl = (word: number) => isBranch(word) || isJump(word);

export function branchTarget(word: number, pc: number): number | null {
  if (isBranch(word)) return pc + 4 + (immOf(word) << 2);
  const op = opOf(word);
  if (op === 0x02 || op === 0x03) {
    return (((pc + 4) & 0xf0000000) | ((word & 0x03ffffff) << 2)) >>> 0;
  }
  return null;
}

/** `j`と`jal`。飛び先は256MB領域内でなければならない。 */
export function j(target: number, link = false): number {
  if ((target & 3) !== 0) throw new Error("jump先が4バイト境界にない");
  return (((link ? 0x03 : 0x02) << 26) | ((target >>> 2) & 0x03ffffff)) >>> 0;
}

/** 元の分岐命令の条件を保ち、飛び先だけを差し替える。 */
export function rebranch(word: number, pc: number, target: number): number {
  const delta = (target - (pc + 4)) >> 2;
  if (delta < -0x8000 || delta > 0x7fff) throw new Error("分岐が届かない");
  return ((word & 0xffff0000) | (delta & 0xffff)) >>> 0;
}
