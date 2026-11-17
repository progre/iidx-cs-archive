// 絶対番地を作る`lui`/`addiu`の組を、別の番地へ向け直す。

import { type MutableElf, overwriteCode } from "../../../elf/mod.ts";
import { immOf, opOf, rsOf, rtOf, withImmediate } from "../../mips/mod.ts";

const OP_LUI = 0x0f;
const OP_ADDIU = 0x09;
const high = (address: number) => ((address + 0x8000) >>> 16) & 0xffff;

export function retargetPair(
  elf: MutableElf,
  luiAddress: number,
  addiuAddress: number,
  from: number,
  to: number,
): void {
  const upper = elf.u32(luiAddress);
  const lower = elf.u32(addiuAddress);
  const same = opOf(upper) === OP_LUI && opOf(lower) === OP_ADDIU &&
    rtOf(upper) === rsOf(lower) && rtOf(lower) === rsOf(lower) &&
    (immOf(upper) & 0xffff) === high(from) &&
    (immOf(lower) & 0xffff) === (from & 0xffff);
  if (!same) {
    throw new Error(
      `0x${luiAddress.toString(16)}の組が0x${from.toString(16)}を作っていない`,
    );
  }
  overwriteCode(elf, luiAddress, [withImmediate(upper, high(to))]);
  overwriteCode(elf, addiuAddress, [withImmediate(lower, to & 0xffff)]);
}
