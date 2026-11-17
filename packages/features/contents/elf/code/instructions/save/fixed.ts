/**
 * 参照表に乗らない書き換え。コンストラクターの領域境界、確保量、保存サイズの
 * 定数と、score基底から外れたpointerに足すstride(`addiu`)を扱う。
 * 後者は参照表が拾えないので、命令を直接走査して見つける。
 */

import { immOf, opOf, rsOf, withImmediate } from "../../mips/mod.ts";
import type { Patch } from "./common.ts";
import { isStride, type SaveLayout, scaleStride } from "./layout.ts";

/** `lui`(無ければnull)と`ori`の位置。値は新配置から求める。 */
const CONSTANTS: readonly Readonly<{
  hi: number | null;
  lo: number;
  value: (layout: SaveLayout) => number;
}>[] = [
  { hi: 0x1681b4, lo: 0x1681c0, value: (layout) => layout.allocation },
  { hi: null, lo: 0x168310, value: (layout) => layout.starts.get("tableB")! },
  {
    hi: 0x168330,
    lo: 0x168338,
    value: (layout) => layout.starts.get("bytes")!,
  },
  {
    hi: 0x16834c,
    lo: 0x168350,
    value: (layout) => layout.starts.get("tableC")!,
  },
  {
    hi: 0x168360,
    lo: 0x168368,
    value: (layout) => layout.starts.get("tableD")!,
  },
  { hi: 0x168384, lo: 0x16838c, value: (layout) => layout.starts.get("aux")! },
  { hi: 0x199800, lo: 0x199808, value: (layout) => layout.saveSize },
];

/**
 * stride即値とshift列を命令から直接走査する関数の範囲。
 * scoreを触る関数群と、その後ろの初期化関数。
 */
export const SCAN_RANGES: readonly (readonly [number, number])[] = [
  [0x195fe0, 0x199ae0],
  [0x19a2a0, 0x19aec8],
];

export function constantPatches(
  layout: SaveLayout,
  wordAt: (address: number) => number,
): Patch[] {
  const patches: Patch[] = [];
  for (const constant of CONSTANTS) {
    const value = constant.value(layout);
    const lo = wordAt(constant.lo);
    if (constant.hi === null) {
      // `ori rt, zero, K`。零拡張16bitに収まらなければstubで作る。
      patches.push(
        value <= 0xffff
          ? {
            address: constant.lo,
            newWord: withImmediate(lo, value),
            usage: "ori",
          }
          : {
            address: constant.lo,
            far: value,
            newWord: lo,
            usage: "far_constant",
          },
      );
      continue;
    }
    patches.push(
      {
        address: constant.hi,
        newWord: withImmediate(wordAt(constant.hi), value >>> 16),
        usage: "lui",
      },
      { address: constant.lo, newWord: withImmediate(lo, value), usage: "ori" },
    );
  }
  return patches;
}

/**
 * `addiu rt, rs, stride`を命令の直接走査で補う。`li`(rs == zero)は`0x63`だけ曲数の即値として
 * 曲数パッチに任せ、他のstride(`0x630`など、乗算の片側になる)は倍率で写す。
 * 既に参照表から書き換えた位置は飛ばす。
 */
export function scannedStridePatches(
  layout: SaveLayout,
  wordAt: (address: number) => number,
  patched: ReadonlySet<number>,
): Patch[] {
  const patches: Patch[] = [];
  for (const [lo, hi] of SCAN_RANGES) {
    for (let address = lo; address < hi; address += 4) {
      const word = wordAt(address);
      const op = opOf(word);
      if (op !== 0x09 && op !== 0x19) continue;
      const imm = immOf(word);
      if (rsOf(word) === 0 && imm === 0x63) continue;
      if (!isStride(imm) || patched.has(address)) continue;
      const scaled = scaleStride(layout, imm);
      patches.push(
        scaled <= 0x7fff
          ? {
            address,
            newWord: withImmediate(word, scaled),
            usage: "stride_scan",
          }
          : { address, far: scaled, newWord: word, usage: "far_stride" },
      );
    }
  }
  return patches;
}
