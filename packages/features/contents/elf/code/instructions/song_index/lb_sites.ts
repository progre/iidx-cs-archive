/**
 * 選曲 context の曲index配列 (context+0x1f8+項目index) を読み出す `lb` を全件拾い、
 * `lbu` に変える書き換えを返す。
 *
 * この配列の値は曲DBアクセサの引数に渡り、符号付きの積で曲DB先頭+曲index*0x134が
 * 計算される。曲index 128以上を `lb` で読むと負値になり、曲DBより手前を指す。
 * 即値0x1f8の走査に加え、先頭addressをregisterに作ってから読むpointer形と、
 * record 1の配列を0x5e0で読む形を確定リストで足す。
 */

import {
  hexAddress,
  type InstructionPatch,
  type MutableElf,
  requireWord,
} from "../../../elf/mod.ts";
import { opOf, REG_NAMES, rsOf, rtOf } from "../../mips/mod.ts";

export const LBU_ACTION = "change_to_lbu";
const SONG_INDEX_OFFSET = 0x1f8;
const OP_LB = 0x20;
const OP_LBU = 0x24;
const RATIONALE = "曲index128以上を負値にしない";
const ACCESSOR = "曲DBアクセサの引数a1";
const OTHER_ACCESSOR = "別の曲DB参照関数の引数a1";

/** 即値走査に出ない曲index読出し。address、参照の形、用途の順。 */
const CONFIRMED_EXTRA: readonly (readonly [number, string, string])[] = [
  [0x20d690, "pointer s7", "曲indexを" + ACCESSOR + "へ読出し"],
  [0x20d6f0, "pointer s7", "曲indexをcacheA indexのa3へ読出し"],
  [0x20f9b8, "record1+0x1f8", "曲indexを" + OTHER_ACCESSOR + "へ読出し"],
  [0x20fa08, "record1+0x1f8", "曲indexを" + OTHER_ACCESSOR + "へ読出し"],
  [0x2119b0, "pointer s7", "曲indexを" + ACCESSOR + "へ読出し"],
  [0x211a20, "pointer s7", "曲indexを" + ACCESSOR + "へ読出し"],
  [0x211b78, "pointer s7", "曲indexを" + ACCESSOR + "へ読出し"],
  [0x211d0c, "pointer s7", "曲indexを隣へ複写"],
  // 0x212808と0x21288cの1バイト読出しはslot 0x150経由の難易度読出しであり対象外。
  [0x212818, "stack退避pointer v1", "曲indexを" + ACCESSOR + "へ読出し"],
  [0x21289c, "stack退避pointer v1", "曲indexを" + ACCESSOR + "へ読出し"],
  [0x212a2c, "stack退避pointer v1", "曲indexを隣へ複写"],
  [0x212a44, "stack退避pointer v1", "曲indexを隣へ複写"],
];

const toLbu = (word: number) => ((word & 0x03ffffff) | (OP_LBU << 26)) >>> 0;

function row(
  address: number,
  oldWord: number,
  reference: string,
  usage: string,
): InstructionPatch {
  return {
    action: LBU_ACTION,
    address,
    functionName: "",
    newReference: reference,
    newWord: toLbu(oldWord),
    oldReference: reference,
    oldWord,
    rationale: RATIONALE,
    referenceForm: "lb_to_lbu",
    sourceAddress: hexAddress(address),
    usage,
  };
}

export function buildSongIndexLbuPatches(elf: MutableElf): InstructionPatch[] {
  const rows: InstructionPatch[] = [];
  for (const segment of elf.segments) {
    for (let at = 0; at + 4 <= segment.fileSize; at += 4) {
      const word = elf.dv.getUint32(segment.fileOffset + at, true);
      if ((word & 0xffff) !== SONG_INDEX_OFFSET || opOf(word) !== OP_LB) {
        continue;
      }
      rows.push(row(
        segment.vaddr + at,
        word,
        "context+0x1f8+item",
        "曲index配列を" + REG_NAMES[rtOf(word)] + "へ読出し base=" +
          REG_NAMES[rsOf(word)],
      ));
    }
  }
  for (const [address, form, usage] of CONFIRMED_EXTRA) {
    const word = requireWord(elf, address);
    if (opOf(word) !== OP_LB) {
      throw new Error(hexAddress(address) + "は`lb`ではない");
    }
    rows.push(row(address, word, form, usage));
  }
  return rows;
}
