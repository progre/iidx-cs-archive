/**
 * shift列で`99x`または`495x`(`99*5x`)を合成する箇所を、曲容量`S`の倍に組み替える。
 *
 * 原盤は、`x`を5bit左シフトして`x`を足し(33x)、q bit左シフトした値から引く。
 * `q=2`が`(33x)*3 = 99x`、`q=4`が`(33x)*15 = 495x`を作る。4つの演算と宛先registerは変えない。
 * 目標の倍率は、`(2^p+1)`と`(2^q±1)`の積で作る。`2^p`を使うときは、加算を移動に替える。
 */

import { addu, decodeFields, opOf, sll, subu } from "../../mips/mod.ts";
import type { Patch } from "./common.ts";

export type Chain = Readonly<{
  /** 5bit左シフト、`x`の加算、q bit左シフト、引き算の4つの演算の位置。 */
  addresses: readonly [number, number, number, number];
  /** 99または495。 */
  multiplier: number;
}>;

type Plan = Readonly<
  { addSource: boolean; p: number; q: number; sub: boolean }
>;

const isSll = (word: number) => opOf(word) === 0 && (word & 0x3f) === 0;
const isAddu = (word: number) => opOf(word) === 0 && (word & 0x3f) === 0x21;
const isSubu = (word: number) => opOf(word) === 0 && (word & 0x3f) === 0x23;
const STORE_OR_BRANCH = new Set([
  0x01,
  0x04,
  0x05,
  0x06,
  0x07,
  0x14,
  0x15,
  0x16,
  0x17,
  0x28,
  0x29,
  0x2b,
  0x2c,
  0x2d,
  0x2e,
  0x2f,
  0x3f,
]);
/** 命令が書くregister。R形式は`rd`、I形式は`rt`、storeと分岐は無し。 */
function writes(word: number): number {
  const d = decodeFields(word);
  if (d.op === 0) return d.rd;
  return STORE_OR_BRANCH.has(d.op) || d.op === 0x02 || d.op === 0x03 ? 0 : d.rt;
}

/** `address`から遡り、条件に合う最初の命令を返す。遡りは64命令で打ち切る。 */
function definerMatching(
  wordAt: (address: number) => number,
  address: number,
  lo: number,
  matches: (word: number) => boolean,
): number | null {
  for (let back = address - 4; back >= address - 256 && back >= lo; back -= 4) {
    if (matches(wordAt(back))) return back;
  }
  return null;
}

/** `register`を最後に書いた命令を`address`から遡って探す。 */
const definer = (
  wordAt: (address: number) => number,
  address: number,
  lo: number,
  register: number,
) => definerMatching(wordAt, address, lo, (word) => writes(word) === register);

/** 引き算から遡り、q bit左シフト、`x`の加算、5bit左シフトの連鎖を探す。 */
export function findChains(
  wordAt: (address: number) => number,
  ranges: readonly (readonly [number, number])[],
): Chain[] {
  const chains: Chain[] = [];
  for (const [lo, hi] of ranges) {
    for (let address = lo; address < hi; address += 4) {
      if (!isSubu(wordAt(address))) continue;
      const sub = decodeFields(wordAt(address));
      const sllC = definer(wordAt, address, lo, sub.rs);
      if (sllC === null) continue;
      const c = decodeFields(wordAt(sllC));
      if (!isSll(wordAt(sllC)) || c.rt !== sub.rt) continue;
      if (c.sa !== 2 && c.sa !== 4) continue;
      const addB = definer(wordAt, sllC, lo, sub.rt);
      if (addB === null || !isAddu(wordAt(addB))) continue;
      const b = decodeFields(wordAt(addB));
      // 5bit左シフトは分岐の遅延スロットにあり、別経路の`lui`が同じregisterを書くことがある。
      // 経路をまたいで最初に見つかる5bit左シフトを採る。
      const sllA = definerMatching(wordAt, addB, lo, (word) => {
        const a = decodeFields(word);
        return isSll(word) && a.rd === b.rs && a.sa === 5 && a.rt === b.rt;
      });
      if (sllA === null) continue;
      chains.push({
        addresses: [sllA, addB, sllC, address],
        multiplier: 33 * ((1 << c.sa) - 1),
      });
    }
  }
  return chains;
}

/**
 * 4命令で`target`倍を作る組み合わせ。原盤の手順(引き算と、`x`の加算)を優先し、
 * `S=99`では原盤と同じ語になるようにする。
 */
export function planFor(target: number): Plan | null {
  for (const sub of [true, false]) {
    for (const addSource of [true, false]) {
      for (let q = 1; q < 16; q++) {
        for (let p = 0; p < 16; p++) {
          const left = (1 << p) + (addSource ? 1 : 0);
          const right = (1 << q) + (sub ? -1 : 1);
          if (left * right === target) return { addSource, p, q, sub };
        }
      }
    }
  }
  return null;
}

/** 原盤の4命令を、曲容量`S`に合わせた列に書き換える。宛先registerは保つ。 */
export function rewriteChain(
  wordAt: (address: number) => number,
  chain: Chain,
  songs: number,
): Patch[] {
  const target = chain.multiplier / 99 * songs;
  const plan = planFor(target);
  if (plan === null) {
    throw new Error(
      `倍率${target}を4命令で合成できない: 0x${
        chain.addresses[3].toString(16)
      }`,
    );
  }
  const [sllA, addB, sllC, subD] = chain.addresses;
  const a = decodeFields(wordAt(sllA)), add = decodeFields(wordAt(addB));
  const c = decodeFields(wordAt(sllC)), d = decodeFields(wordAt(subD));
  const join = plan.sub ? subu : addu;
  return [
    { address: sllA, newWord: sll(a.rd, a.rt, plan.p), usage: "shift_chain" },
    {
      address: addB,
      newWord: addu(add.rd, add.rs, plan.addSource ? add.rt : 0),
      usage: "shift_chain",
    },
    { address: sllC, newWord: sll(c.rd, c.rt, plan.q), usage: "shift_chain" },
    { address: subD, newWord: join(d.rd, d.rs, d.rt), usage: "shift_chain" },
  ];
}
