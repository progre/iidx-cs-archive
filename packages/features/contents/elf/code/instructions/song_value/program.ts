/**
 * stub生成の入力ELF。命令語の読み出し、分岐先の一覧、符号拡張の組の先行反映、
 * 差し替え行の帳簿をまとめる。
 */

import {
  type InstructionPatch,
  type MutableElf,
  requireWord,
} from "../../../elf/mod.ts";
import { branchTarget, decodeFields } from "../../mips/mod.ts";
import { SIGN_EXTENSION_PAIRS } from "../song_index/mod.ts";
import type { Context } from "./forms.ts";

export const SONG_VALUE_WIDTH_ACTION = "apply_song_value_width";
const TEXT_RANGE = [0x100000, 0x2b0000] as const;
const FN_DSLL32 = 0x3c;
const FN_DSRL32 = 0x3e;
const SHIFT_8BIT = 0x18;
const SHIFT_16BIT = 0x10;

const hex = (value: number) => "0x" + (value >>> 0).toString(16);

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export class Program {
  readonly #elf: MutableElf;
  readonly #targets = new Set<number>();
  /**
   * その場で書き換える命令語(符号拡張のshift量、mode・flags配列の移設)。stubへ預けられる
   * こともあるので、差し替え前の命令語として先に反映し、預けられなかった分だけ行にする。
   */
  readonly #rewritten = new Map<number, { usage: string; word: number }>();
  readonly #emitted = new Map<number, InstructionPatch>();
  readonly #consumed = new Set<number>();

  constructor(elf: MutableElf) {
    this.#elf = elf;
    this.#collectTargets();
    this.#applySignExtension();
  }

  wordAt(address: number): number {
    return requireWord(this.#elf, address);
  }

  /** stubへ預ける前の命令語。その場で書き換える命令は変更後の語を返す。 */
  effectiveWord(address: number): number {
    return this.#rewritten.get(address)?.word ?? this.wordAt(address);
  }

  rewrite(address: number, word: number, usage: string): void {
    assert(!this.#rewritten.has(address), "書き換えが重複: " + hex(address));
    this.#rewritten.set(address, { usage, word });
  }

  get context(): Context {
    return {
      isConsumed: (address) => this.#consumed.has(address),
      isTarget: (address) => this.#targets.has(address),
      wordAt: (address) => this.effectiveWord(address),
    };
  }

  consume(addresses: readonly number[]): void {
    for (const address of addresses) this.#consumed.add(address);
  }

  isConsumed(address: number): boolean {
    return this.#consumed.has(address);
  }

  emitRow(address: number, newWord: number, usage: string): void {
    const oldWord = this.wordAt(address);
    assert(!this.#emitted.has(address), "差し替えが重複: " + hex(address));
    if (newWord === oldWord) return;
    this.#emitted.set(address, {
      action: SONG_VALUE_WIDTH_ACTION,
      address,
      functionName: "",
      newReference: hex(newWord),
      newWord,
      oldReference: hex(oldWord),
      oldWord,
      rationale: "曲値を16bitで扱う",
      referenceForm: "song_value_width",
      sourceAddress: hex(address),
      usage,
    });
  }

  /** stubへ預けられなかった書き換えを行にする。 */
  emitUnconsumedRewrites(): void {
    for (const [address, { usage, word }] of this.#rewritten) {
      if (!this.#consumed.has(address)) this.emitRow(address, word, usage);
    }
  }

  rows(): InstructionPatch[] {
    return [...this.#emitted.values()].sort((a, b) => a.address - b.address);
  }

  // 分岐・ジャンプの飛び先と、データ領域にあるtext範囲の語(jump table候補)。
  #collectTargets(): void {
    for (const segment of this.#elf.segments) {
      for (let at = 0; at + 4 <= segment.fileSize; at += 4) {
        const address = segment.vaddr + at;
        const word = this.#elf.dv.getUint32(segment.fileOffset + at, true);
        if (address >= TEXT_RANGE[0] && address < TEXT_RANGE[1]) {
          const target = branchTarget(word, address);
          if (target !== null) this.#targets.add(target);
        } else if (
          word >= TEXT_RANGE[0] && word < TEXT_RANGE[1] && (word & 3) === 0
        ) {
          this.#targets.add(word);
        }
      }
    }
  }

  // 曲indexをcharに戻す組は16bitを残すshift量に変える。
  #applySignExtension(): void {
    for (const [shl, shr] of SIGN_EXTENSION_PAIRS) {
      const left = decodeFields(this.wordAt(shl));
      const right = decodeFields(this.wordAt(shr));
      assert(
        left.fn === FN_DSLL32 && left.sa === SHIFT_8BIT,
        "dsll32 0x18ではない: " + hex(shl),
      );
      assert(
        right.fn === FN_DSRL32 && right.sa === SHIFT_8BIT,
        "零拡張済みのdsrl32 0x18ではない: " + hex(shr),
      );
      const usage = "sign_extension";
      const widened = (address: number) =>
        (this.wordAt(address) & ~0x7c0) | (SHIFT_16BIT << 6);
      this.rewrite(shl, widened(shl), usage);
      this.rewrite(shr, widened(shr), usage);
    }
  }
}
