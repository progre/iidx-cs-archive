/**
 * 新規セーブを全ての隠し要素を解禁した状態で作る。
 * stub領域の置き場`unlock`に、既定解禁一覧と初期化のstubを置く。
 */

import type { InstructionPatch, MutableElf } from "../../../../elf/mod.ts";
import { STUB_SLOTS } from "../../../../data/stub_area/mod.ts";
import { assert } from "../common.ts";
import { unlockListHalves, unlockListPatches } from "./list.ts";
import { buildModuleUnlock } from "./modules.ts";

const SLOT = STUB_SLOTS.unlock;
const BASE = SLOT.vaddr;
/** 表A・表Bの一覧。1曲4バイトなので1919曲まで置ける */
export const LIST_CAPACITY = 0x1e00;
const STUB_OFFSET = LIST_CAPACITY;
const STUB_BYTES = SLOT.bytes - STUB_OFFSET;

export type UnlockList = Readonly<{
  bytes: Uint8Array;
  patches: readonly InstructionPatch[];
}>;

export function buildUnlockList(elf: MutableElf, songs: number): UnlockList {
  const { halves, starts } = unlockListHalves(songs);
  assert(halves.length * 2 <= LIST_CAPACITY, "一覧が確保容量を超える");
  const modules = buildModuleUnlock(elf, BASE + STUB_OFFSET);
  assert(modules.words.length * 4 <= STUB_BYTES, "stubが確保容量を超える");

  const bytes = new Uint8Array(STUB_OFFSET + modules.words.length * 4);
  const view = new DataView(bytes.buffer);
  halves.forEach((half, index) => view.setUint16(index * 2, half, true));
  modules.words.forEach((word, index) =>
    view.setUint32(STUB_OFFSET + index * 4, word, true)
  );
  return {
    bytes,
    patches: [...unlockListPatches(elf, BASE, starts), ...modules.patches],
  };
}
