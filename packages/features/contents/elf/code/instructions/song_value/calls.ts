/**
 * 複写と初期化の呼び出しを、移設した配列と上位byte配列にも掛かる関数stubに差し替える。
 * byte access命令の即値だけをずらす`relocate`もここに置く。
 */

import {
  addiu,
  immOf,
  j,
  jr,
  ld,
  NOP,
  opOf,
  reg,
  rsOf,
  sd,
} from "../../mips/mod.ts";

export const MEMCPY = 0x12ad48;
export const MEMSET = 0x12af00;
const FRAME = 0x30;

/** byte access命令の即値だけを`delta`ずらす。上位配列を持たないmode・flags配列に使う。 */
export function relocate(word: number, delta: number): number {
  const op = opOf(word);
  if (op !== 0x20 && op !== 0x24 && op !== 0x28) {
    throw new Error("lb/lbu/sb以外の命令は移せない: 0x" + word.toString(16));
  }
  if (rsOf(word) === reg.sp) throw new Error("spを基底にするsiteは移せない");
  const imm = immOf(word) + delta;
  if (imm < -0x8000 || imm > 0x7fff) {
    throw new Error("移設先が16bit即値に収まらない");
  }
  return ((word & 0xffff0000) | (imm & 0xffff)) >>> 0;
}

export type CallDeltas = Readonly<{ destination: number; source: number }>;

/**
 * 呼び出し元の`jal`を`jal stub`に差し替える。遅延スロットは元のまま実行されるので、
 * 引数の並びは崩れない。元の引数を退避し、呼び出しごとに`a0 += destination`、
 * `a1 += source`(memcpyのみ)して`target`を呼ぶ。返り値は最後の呼び出しのものになる。
 */
export function callTimes(
  target: number,
  calls: readonly CallDeltas[],
): readonly number[] {
  if (calls.length === 0) throw new Error("呼び出しが1つもない");
  const words = [
    addiu(reg.sp, reg.sp, -FRAME),
    sd(reg.ra, 0x20, reg.sp),
    sd(reg.a0, 0x00, reg.sp),
    sd(reg.a1, 0x08, reg.sp),
    sd(reg.a2, 0x10, reg.sp),
  ];
  for (const [index, call] of calls.entries()) {
    if (target !== MEMCPY && call.source !== 0) {
      throw new Error("memset以外の第2引数へ距離は足せない");
    }
    if (index > 0) {
      words.push(
        ld(reg.a0, 0x00, reg.sp),
        ld(reg.a1, 0x08, reg.sp),
        ld(reg.a2, 0x10, reg.sp),
      );
    }
    if (call.destination !== 0) {
      words.push(addiu(reg.a0, reg.a0, call.destination));
    }
    words.push(
      j(target, true),
      call.source === 0 ? NOP : addiu(reg.a1, reg.a1, call.source),
    );
  }
  words.push(
    ld(reg.ra, 0x20, reg.sp),
    addiu(reg.sp, reg.sp, FRAME),
    jr(reg.ra),
    NOP,
  );
  return words;
}
