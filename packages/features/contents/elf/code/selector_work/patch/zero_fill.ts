/** 前段初期化はterminalRecordまでを消していた。work末尾に足した表まで届かせる。 */

import type { InstructionPatchBook } from "../../../elf/mod.ts";
import { withImmediate } from "../../mips/mod.ts";
import type { WordAt } from "./patch_high.ts";

const HIGH_ADDRESS = 0x20dca4;
const LOW_ADDRESS = 0x20dcd4;
/**
 * 消す長さを作る2語。原盤の長さ`0x30cf0`は終端レコードの位置と同じ値である。
 * このため配置由来の書き換えは、この2語を終端レコードの参照と誤って分類する。
 * 長さはこの段だけが書く
 */
export const ZERO_FILL_SITES: ReadonlySet<number> = new Set([
  HIGH_ADDRESS,
  LOW_ADDRESS,
]);

const hex = (value: number) => "0x" + (value >>> 0).toString(16);

export function addAppendZeroFill(
  book: InstructionPatchBook,
  structSize: number,
  action: string,
  wordAt: WordAt,
): void {
  const shared = {
    action,
    functionName: "選曲ワークの初期化",
    newReference: hex(structSize),
    oldReference: "0x30cf0",
    rationale: "work末尾へ追加した表まで初期化",
    usage: "appendZeroFill",
  };
  book.add(
    HIGH_ADDRESS,
    withImmediate(wordAt(HIGH_ADDRESS), structSize >>> 16),
    { ...shared, referenceForm: "lui_hi", sourceAddress: hex(HIGH_ADDRESS) },
  );
  book.add(
    LOW_ADDRESS,
    withImmediate(wordAt(LOW_ADDRESS), structSize & 0xffff),
    { ...shared, referenceForm: "lui_lo", sourceAddress: hex(LOW_ADDRESS) },
  );
}
