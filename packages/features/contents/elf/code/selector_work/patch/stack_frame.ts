/**
 * category 0x38経路はrecordをstack上に作る。frame内訳は保存register[0x00,0x98)、
 * scratch[0xa0,0xb0)、引数退避[0xb8,0xc0)、record[0xc0,frame)である。record以外の
 * sp参照は0xbcまでで、frameを深くしても動かない。
 */

import type { InstructionPatchBook } from "../../../elf/mod.ts";
import { withImmediate } from "../../mips/mod.ts";
import type { WordAt } from "./patch_high.ts";

export const STACK_RECORD_START = 0xc0;
export const PB_STACK_FRAME = 0x4b0;
const PROLOGUE_ADDRESS = 0x20d250;
const EPILOGUE_ADDRESS = 0x20d88c;

const align16 = (value: number) => (value + 15) & ~15;
const hex = (value: number) => "0x" + (value >>> 0).toString(16);

export function stackFrameFor(recordSize: number): number {
  const frame = align16(STACK_RECORD_START + recordSize);
  return Math.max(frame, PB_STACK_FRAME);
}

/**
 * frameが深くなる構成でだけprologueとepilogueの即値を書き換える。
 * 保存registerとscratchはframe先頭側にあり、offsetは据え置きでよい。
 */
export function addStackFrameGrowth(
  book: InstructionPatchBook,
  recordSize: number,
  action: string,
  wordAt: WordAt,
): number {
  const frame = stackFrameFor(recordSize);
  if (frame > 0x7ff0) throw new Error("stack frameが16bit即値へ収まりません");
  if (frame === PB_STACK_FRAME) return 0;
  const shared = {
    action,
    functionName: "カテゴリー集計",
    newReference: hex(frame),
    oldReference: hex(PB_STACK_FRAME),
    rationale: "stack合成recordをrecord長へ収める",
    usage: "stackFrame",
  };
  book.add(PROLOGUE_ADDRESS, withImmediate(wordAt(PROLOGUE_ADDRESS), -frame), {
    ...shared,
    referenceForm: "frame_allocate",
    sourceAddress: hex(PROLOGUE_ADDRESS),
  });
  book.add(EPILOGUE_ADDRESS, withImmediate(wordAt(EPILOGUE_ADDRESS), frame), {
    ...shared,
    referenceForm: "frame_release",
    sourceAddress: hex(EPILOGUE_ADDRESS),
  });
  return 2;
}
