// テスト専用。スタブが使う命令だけを実行し、スタブの外へ出た番地とレジスターを返す。

import { fnOf, immOf, opOf, rdOf, rsOf, rtOf } from "../../mips/mod.ts";

export interface RunResult {
  /** スタブの外へ出た番地。`jr`で戻ったときは戻り番地 */
  exit: number;
  memory: Map<number, number>;
  regs: number[];
}

export interface RunInput {
  base: number;
  /** `jal`で呼ぶ外の関数。呼ばずに戻ったものとして扱う */
  calls?: Set<number>;
  regs?: Record<number, number>;
  words: readonly number[];
}

const u32 = (value: number) => value >>> 0;

export function runStub(input: RunInput): RunResult {
  const regs = Array.from({ length: 32 }, () => 0);
  for (const [index, value] of Object.entries(input.regs ?? {})) {
    regs[Number(index)] = u32(value);
  }
  const memory = new Map<number, number>();
  const store = (address: number, value: number, bytes: number) => {
    for (let i = 0; i < bytes; i++) {
      memory.set(address + i, Number((BigInt(value) >> BigInt(i * 8)) & 0xffn));
    }
  };
  const inside = (pc: number) =>
    pc >= input.base && pc < input.base + input.words.length * 4;
  let pc = input.base;
  let pending: number | undefined;
  for (let steps = 0; steps < 10000; steps++) {
    if (!inside(pc)) return { exit: pc, memory, regs };
    const word = input.words[(pc - input.base) >>> 2];
    const next = execute(word, pc, regs, store, input.calls);
    regs[0] = 0;
    const target = pending;
    pending = next;
    pc = target ?? pc + 4;
  }
  throw new Error("スタブが止まらない");
}

type Store = (address: number, value: number, bytes: number) => void;

/** 1命令を実行する。分岐・ジャンプなら遅延スロットの後の番地を返す */
function execute(
  word: number,
  pc: number,
  regs: number[],
  store: Store,
  calls?: Set<number>,
): number | undefined {
  const op = opOf(word), rs = rsOf(word), rt = rtOf(word), imm = immOf(word);
  const signed = (r: number) => regs[r] | 0;
  const branch = (taken: boolean) => taken ? pc + 4 + (imm << 2) : pc + 8;
  switch (op) {
    case 0x00:
      return special(word, regs);
    case 0x02:
      return u32(((pc + 4) & 0xf0000000) | ((word & 0x03ffffff) << 2));
    case 0x03: {
      const target = u32(((pc + 4) & 0xf0000000) | ((word & 0x03ffffff) << 2));
      if (!calls?.has(target)) throw new Error("知らない関数を呼んだ");
      return undefined;
    }
    case 0x04:
      return branch(regs[rs] === regs[rt]);
    case 0x05:
      return branch(regs[rs] !== regs[rt]);
    case 0x09:
      regs[rt] = u32(regs[rs] + imm);
      return undefined;
    case 0x0a:
      regs[rt] = signed(rs) < imm ? 1 : 0;
      return undefined;
    case 0x0d:
      regs[rt] = u32(regs[rs] | (imm & 0xffff));
      return undefined;
    case 0x0f:
      regs[rt] = u32((imm & 0xffff) << 16);
      return undefined;
    case 0x28:
      store(u32(regs[rs] + imm), regs[rt], 1);
      return undefined;
    case 0x2b:
      store(u32(regs[rs] + imm), regs[rt], 4);
      return undefined;
    case 0x37:
    case 0x3f:
      // 退避と復元は値を持ち越さないので、スタックの読み書きは省く
      return undefined;
  }
  throw new Error(`未対応の命令: 0x${word.toString(16)}`);
}

function special(word: number, regs: number[]): number | undefined {
  const rs = rsOf(word), rt = rtOf(word), rd = rdOf(word);
  switch (fnOf(word)) {
    case 0x00:
      if (word !== 0) throw new Error("sllは使わない");
      return undefined;
    case 0x08:
      return regs[rs];
    case 0x21:
      regs[rd] = u32(regs[rs] + regs[rt]);
      return undefined;
    case 0x25:
      regs[rd] = u32(regs[rs] | regs[rt]);
      return undefined;
  }
  throw new Error(`未対応の命令: 0x${word.toString(16)}`);
}
