// 選曲画面へ追加のバージョン別フォルダーを1つ足す。
// 作品番号16以上の曲は、選曲ワーク末尾のレコード5本へ入れる。
// フォルダー一覧では、原盤のバージョン別の最後の枠の直後に並べる。

import { type MutableElf, overwriteCode } from "../../../elf/mod.ts";
import type { FolderNameImages, SongCapacity } from "../../../model/mod.ts";
import { branchTarget, j, jal, move, reg } from "../../mips/mod.ts";
import {
  addedFolderStart,
  selectorWorkLayout,
  type WorkLayout,
} from "../../selector_work/mod.ts";
import { slotCursor } from "../area.ts";
import {
  groupWords,
  listLoopWords,
  randomWords,
  selectWords,
} from "./list_stubs.ts";
import { entryWords, initWords, versionWords } from "./record_stubs.ts";
import {
  ADDED_CATEGORY,
  ADDED_SLOT,
  ENTRY_HOOKS,
  GROUP_SITE,
  INIT_CALL,
  LIST_LOOPS,
  RANDOM_SITE,
  SELECT_SITE,
  STATE_CATEGORY_SITE,
  VERSION_CALL,
  wrappedSlot,
} from "./sites.ts";
import { categoryTables, TABLE_BYTES, tableWords } from "./tables.ts";
import { retargetPair } from "./pairs.ts";

function expect(condition: boolean, message: string): void {
  if (!condition) throw new Error(`追加フォルダー: ${message}`);
}

/** 2語を差し替える。1語目はスタブへの`j`で、2語目は遅延スロットのNOPである */
function hook(elf: MutableElf, site: number, stub: number): void {
  overwriteCode(elf, site, [j(stub)], 2);
}

function writeTables(
  elf: MutableElf,
  place: (w: number[]) => number,
  names?: FolderNameImages,
): void {
  for (const table of categoryTables(names)) {
    const at = place(tableWords(table, (a) => elf.u32(a)));
    for (const [high, low] of table.pairs) {
      retargetPair(elf, high, low, table.source, at);
    }
  }
}

function writeRecordHooks(
  elf: MutableElf,
  place: (w: number[]) => number,
  layout: WorkLayout,
  slot: number,
): void {
  const wordAt = (a: number) => elf.u32(a);
  const wrapped = wrappedSlot(slot, layout.recordSize);
  for (const h of ENTRY_HOOKS) {
    hook(elf, h.entry, place(entryWords(h.entry, wrapped, wordAt)));
  }
  overwriteCode(elf, VERSION_CALL, [jal(place(versionWords(slot)))]);
  const start = addedFolderStart(slot, layout.recordSize);
  overwriteCode(elf, INIT_CALL, [
    jal(place(initWords(start, layout.recordSize))),
  ]);
}

function writeListHooks(elf: MutableElf, place: (w: number[]) => number): void {
  for (const loop of LIST_LOOPS) {
    hook(elf, loop.site, place(listLoopWords(loop)));
  }
  overwriteCode(elf, STATE_CATEGORY_SITE, [move(reg.a1, reg.s3)]);
  hook(elf, GROUP_SITE, place(groupWords()));
  hook(elf, RANDOM_SITE, place(randomWords()));
  hook(elf, SELECT_SITE, place(selectWords()));
}

/** `names`はフォルダー名の画像。無ければ`categoryTables`の既定で代える */
export function writeAddedFolder(
  elf: MutableElf,
  capacity: SongCapacity,
  names?: FolderNameImages,
): void {
  const layout = selectorWorkLayout(capacity);
  const slot = layout.addedFolderSlot;
  expect(slot !== undefined, "選曲ワークに追加フォルダーの枠が無い");
  const place = slotCursor(elf, ADDED_SLOT);
  writeTables(elf, place, names);
  writeRecordHooks(elf, place, layout, slot!);
  writeListHooks(elf, place);
}

/** 差し替えた命令が追加コード領域を指し、表の追加の行が書けていることを確かめる */
export function verifyAddedFolder(
  elf: MutableElf,
  names?: FolderNameImages,
): void {
  const inArea = (word: number, site: number) => {
    const target = branchTarget(word, site) ?? -1;
    return target >= ADDED_SLOT.vaddr &&
      target < ADDED_SLOT.vaddr + ADDED_SLOT.bytes;
  };
  const sites = [
    ...ENTRY_HOOKS.map((h) => h.entry),
    VERSION_CALL,
    INIT_CALL,
    ...LIST_LOOPS.map((loop) => loop.site),
    GROUP_SITE,
    RANDOM_SITE,
    SELECT_SITE,
  ];
  for (const site of sites) {
    expect(inArea(elf.u32(site), site), `0x${site.toString(16)}が書けていない`);
  }
  expect(
    elf.u32(STATE_CATEGORY_SITE) === move(reg.a1, reg.s3),
    "表示状態を引く分類が書けていない",
  );
  categoryTables(names).forEach((table, index) => {
    const at = ADDED_SLOT.vaddr + index * TABLE_BYTES;
    expect(
      elf.u32(at + ADDED_CATEGORY * 4) === table.added >>> 0,
      `${table.name}の表の追加の行が書けていない`,
    );
  });
}
