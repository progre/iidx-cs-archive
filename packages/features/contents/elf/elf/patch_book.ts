/**
 * 1命令の書き換えを集める帳簿。同じaddressに重なる書き換えは、変更ビットが競合しない
 * 限りビット単位で合成する。旧命令語は必ずELFから読み、呼び手が定数で渡すことはない。
 */

import { requireWord, type WordSource } from "./elf.ts";

export interface PatchMetadata {
  action: string;
  functionName: string;
  newReference: string;
  oldReference: string;
  rationale: string;
  referenceForm: string;
  sourceAddress: string;
  usage: string;
}

export interface InstructionPatch extends PatchMetadata {
  address: number;
  newWord: number;
  oldWord: number;
}

export const hexAddress = (value: number) =>
  "0x" + (value >>> 0).toString(16).padStart(8, "0");
const hexWord = hexAddress;

function mergeText(left: string, right: string): string {
  if (left === right || right.length === 0) return left;
  if (left.length === 0) return right;
  return left + " + " + right;
}

export class InstructionPatchBook {
  readonly #elf: WordSource;
  readonly #rows = new Map<number, InstructionPatch>();

  constructor(elf: WordSource) {
    this.#elf = elf;
  }

  add(
    address: number,
    newWord: number,
    metadata: PatchMetadata,
    expectedOld?: number,
  ): void {
    const oldWord = requireWord(this.#elf, address);
    if (expectedOld !== undefined && oldWord !== (expectedOld >>> 0)) {
      throw new Error(
        hexAddress(address) + "の旧命令 " + hexWord(oldWord) + " != " +
          hexWord(expectedOld),
      );
    }
    newWord >>>= 0;
    if (newWord === oldWord) return;
    const previous = this.#rows.get(address);
    if (previous === undefined) {
      this.#rows.set(address, { address, newWord, oldWord, ...metadata });
      return;
    }
    if (previous.oldWord !== oldWord || previous.action !== metadata.action) {
      throw new Error(hexAddress(address) + "の命令パッチ前提が一致しない");
    }
    const previousMask = (oldWord ^ previous.newWord) >>> 0;
    const nextMask = (oldWord ^ newWord) >>> 0;
    if (((previousMask & nextMask) & (previous.newWord ^ newWord)) !== 0) {
      throw new Error(hexAddress(address) + "の変更ビットが競合する");
    }
    const mask = (previousMask | nextMask) >>> 0;
    previous.newWord = (
      (oldWord & ~mask) |
      (previous.newWord & previousMask) |
      (newWord & nextMask)
    ) >>> 0;
    previous.functionName = mergeText(
      previous.functionName,
      metadata.functionName,
    );
    previous.newReference = mergeText(
      previous.newReference,
      metadata.newReference,
    );
    previous.oldReference = mergeText(
      previous.oldReference,
      metadata.oldReference,
    );
    previous.rationale = mergeText(previous.rationale, metadata.rationale);
    previous.referenceForm = mergeText(
      previous.referenceForm,
      metadata.referenceForm,
    );
    previous.usage = mergeText(previous.usage, metadata.usage);
  }

  rows(): InstructionPatch[] {
    return [...this.#rows.values()].sort((a, b) => a.address - b.address);
  }
}
