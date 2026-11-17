/**
 * 曲数と`data/`の表だけから決まる書き換えをまとめる。
 * どの行も原盤の命令語から作るので、まとめて1回で当てられる。
 * 同じ命令に複数の書き換えが重なる場合は、変更ビットが競合しない限り合成する。
 */

import {
  type InstructionPatch,
  InstructionPatchBook,
  type MutableElf,
} from "../../elf/mod.ts";
import {
  buildBasePatches,
  type SegmentLayout,
} from "../../data/segment/mod.ts";
import { buildSelectorWorkPatches } from "../selector_work/mod.ts";
import type { ElfPatchTables, SongCapacity } from "../../model/mod.ts";
import { buildSaveLayoutPatches, buildUnlockList } from "./save/mod.ts";
import {
  buildSelectionItemLbuPatches,
  buildSongCountPatches,
} from "./song_count/mod.ts";

const BASE_ELF_ACTION = "csa_base";

export interface BaseRewrite {
  patches: readonly InstructionPatch[];
  /**
   * 合成前の選曲ワークとセーブ配置の行。16bitに収まらなかった`far_lo`行を
   * 曲値16bit化のstubが引き受ける。
   */
  precedingPatches: readonly InstructionPatch[];
  /** stub領域の後ろへ置く既定の解禁一覧。 */
  unlockBytes: Uint8Array;
}

export function buildBaseRewrite(
  elf: MutableElf,
  capacity: SongCapacity,
  layout: SegmentLayout,
  tables: ElfPatchTables,
): BaseRewrite {
  const selectorWork = buildSelectorWorkPatches(
    elf,
    capacity,
    tables.selectorWorkDirect,
  );
  const save = buildSaveLayoutPatches(
    elf,
    capacity.saveCapacity,
    tables.saveDataReferences,
  );
  const unlock = buildUnlockList(elf, capacity.songCount);
  const book = new InstructionPatchBook(elf);
  const rows = [
    ...buildBasePatches(elf, capacity, layout),
    ...buildSongCountPatches(elf, capacity, tables.songCountImmediates),
    ...buildSelectionItemLbuPatches(elf, tables.selectionItemLbu),
    ...selectorWork.rows,
    ...save,
    ...unlock.patches,
  ];
  for (const row of rows) {
    const { action: _action, address, newWord, oldWord: _old, ...metadata } =
      row;
    book.add(address, newWord, { ...metadata, action: BASE_ELF_ACTION });
  }
  return {
    patches: book.rows(),
    precedingPatches: [...selectorWork.rows, ...save],
    unlockBytes: unlock.bytes,
  };
}
