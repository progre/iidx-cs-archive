/**
 * セーブモジュール#10の配置を曲数に広げる書き換えを作る。
 * 16bitに収まらない即値は`far_lo`行にし、曲値16bit化のstubが引き受ける。
 */

import {
  type InstructionPatch,
  type MutableElf,
  requireWord,
} from "../../../elf/mod.ts";
import {
  hex,
  type Patch,
  type Rewriter,
  type SaveDataReference,
} from "./common.ts";
import { constantPatches, SCAN_RANGES, scannedStridePatches } from "./fixed.ts";
import { makeSaveLayout } from "./layout.ts";
import { rewriteRow } from "./rewrite.ts";
import { findChains, rewriteChain } from "./shifts.ts";

export { buildUnlockList, type UnlockList } from "./unlock/mod.ts";
export type { SaveDataReference };

export const SAVE_LAYOUT_ACTION = "apply_save_layout";

/**
 * `saveCapacity`はセーブ側の曲容量。曲数以上で、shift列が`S`倍と`5S`倍を4命令で
 * 作れる値にする(`511 = 512-1`など)。
 * `references`はセーブ領域を触る命令の表で、`data/elf_patch/`のCSVから読む。
 */
export function buildSaveLayoutPatches(
  elf: MutableElf,
  saveCapacity: number,
  references: readonly SaveDataReference[],
): InstructionPatch[] {
  const layout = makeSaveLayout(saveCapacity);
  const wordAt = (address: number) => requireWord(elf, address);
  const highs = new Map<number, number>();
  const rewriter: Rewriter = {
    claimHigh: (address, high) => {
      const known = highs.get(address);
      if (known !== undefined && known !== high) return false;
      highs.set(address, high);
      return true;
    },
    layout,
    wordAt,
  };

  const consumed = new Set<number>();
  const patches = new Map<number, Patch>();
  const claim = (patch: Patch) => {
    const known = patches.get(patch.address);
    if (
      known !== undefined &&
      (known.newWord !== patch.newWord || known.far !== patch.far)
    ) {
      throw new Error(`${hex(patch.address)}の書き換えが競合する`);
    }
    patches.set(patch.address, patch);
  };
  // accessを先に処理し、その組み立て(lui/ori)を消費してからaddu(pointer形成)を見る。
  const ordered = references.toSorted((a, b) =>
    (a.kind === "addu" ? 1 : 0) - (b.kind === "addu" ? 1 : 0) ||
    a.address - b.address
  );
  for (const row of ordered) {
    for (const patch of rewriteRow(rewriter, row, consumed)) claim(patch);
  }
  for (
    const patch of scannedStridePatches(layout, wordAt, new Set(patches.keys()))
  ) {
    claim(patch);
  }
  for (const patch of constantPatches(layout, wordAt)) claim(patch);
  for (const chain of findChains(wordAt, SCAN_RANGES)) {
    for (const patch of rewriteChain(wordAt, chain, layout.songs)) claim(patch);
  }

  const rows: InstructionPatch[] = [];
  for (
    const patch of [...patches.values()].sort((a, b) => a.address - b.address)
  ) {
    const oldWord = wordAt(patch.address);
    if (patch.far === undefined && patch.newWord === oldWord) continue;
    // far行はstubが命令ごと差し替える。当たらなかった版を「差分なし」で見過ごさないよう、
    // 下位16bitだけ新しい値にしておく。
    const newWord = patch.far === undefined
      ? patch.newWord
      : ((oldWord & 0xffff0000) | (patch.far & 0xffff)) >>> 0;
    rows.push({
      action: SAVE_LAYOUT_ACTION,
      address: patch.address,
      functionName: "",
      newReference: hex(patch.far ?? patch.newWord),
      newWord,
      oldReference: hex(oldWord),
      oldWord,
      rationale: patch.far === undefined
        ? "セーブ配置を曲数へ広げる"
        : "16bitに収まらないためstubで全offsetを作る",
      referenceForm: patch.far === undefined ? "save_layout" : "far_lo",
      sourceAddress: hex(patch.address),
      usage: patch.usage,
    });
  }
  return rows;
}
export { makeSaveLayout } from "./layout.ts";
export { FIXED_REGIONS, locate, regionSize, SONG_REGIONS } from "./regions.ts";
export type { Coordinate } from "./regions.ts";
export { planFor } from "./shifts.ts";
