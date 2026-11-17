// レコードと表のスタブを小さなエミュレーターで実行し、分岐と書き込みを確かめる。原盤は読まない。

import { addiu, reg } from "../../mips/mod.ts";
import { addedFolderSlot, addedFolderStart } from "../../selector_work/mod.ts";
import { entryWords, initWords, versionWords } from "./record_stubs.ts";
import {
  ADDED_CATEGORY,
  INIT_FUNCTION,
  VERSION_FUNCTION,
  wrappedSlot,
} from "./sites.ts";
import type { FolderNameImages } from "../../../model/mod.ts";
import { categoryTables, tableWords } from "./tables.ts";
import { runStub } from "./testing.ts";

const BASE = 0x7fb9000;
const SLOT = 40;
const RECORD_SIZE = 0x3400;

function assertEquals<T>(actual: T, expected: T, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label}: ${actual} != ${expected}`);
  }
}

Deno.test("入口は追加の分類だけを負の値へ置き換え、預けた2語を実行して3語目へ戻る", () => {
  const entry = 0x20ee50;
  const wrapped = wrappedSlot(SLOT, RECORD_SIZE);
  const prologue = (address: number) =>
    addiu(reg.v1, reg.v1, address === entry ? 1 : 2);
  const words = entryWords(entry, wrapped, prologue);
  const run = (category: number) =>
    runStub({ base: BASE, regs: { [reg.a1]: category }, words });
  const added = run(ADDED_CATEGORY);
  assertEquals(added.exit, entry + 8, "戻り先");
  assertEquals(added.regs[reg.a1] | 0, wrapped, "置き換えた分類");
  assertEquals(added.regs[reg.v1], 3, "預けた2語");
  assertEquals(run(0x10).regs[reg.a1], 0x10, "他の分類はそのまま");
});

Deno.test("置き換えた負の分類は、原盤の比較を通り、5レコード長を掛けると枠kと同じ番地になる", () => {
  for (const recordSize of [RECORD_SIZE, 0x3f0, 0x47c]) {
    const wrapped = wrappedSlot(SLOT, recordSize);
    const stride = 5 * recordSize;
    assertEquals(wrapped < 0x11, true, `0x${recordSize.toString(16)}: 比較`);
    assertEquals(
      Math.imul(wrapped, stride) >>> 0,
      (SLOT * stride) >>> 0,
      `0x${recordSize.toString(16)}: 番地`,
    );
  }
});

Deno.test("作品番号は16以上なら枠k - 1、それ以外は原盤のまま返す", () => {
  const words = versionWords(SLOT);
  for (
    const [version, expected] of [[15, 15], [16, SLOT - 1], [17, SLOT - 1], [
      0,
      0,
    ]]
  ) {
    const result = runStub({
      base: BASE,
      calls: new Set([VERSION_FUNCTION]),
      regs: { [reg.v0]: version, [reg.ra]: 0x20fd1c },
      words,
    });
    assertEquals(result.regs[reg.v0], expected, `作品番号${version}`);
    assertEquals(result.exit, 0x20fd1c, "戻り先");
  }
});

Deno.test("初期化は原盤を呼んだあと、追加フォルダーの5本の件数と集約状態を初期値にする", () => {
  const recordSize = 0x100;
  const start = addedFolderStart(SLOT, recordSize);
  const work = 0x100000;
  const result = runStub({
    base: BASE,
    calls: new Set([INIT_FUNCTION]),
    regs: { [reg.s0]: work, [reg.ra]: 0x20d9ec },
    words: initWords(start, recordSize),
  });
  assertEquals(result.exit, 0x20d9ec, "戻り先");
  for (let side = 0; side < 5; side++) {
    const at = work + start + side * recordSize;
    assertEquals(result.memory.get(at + 4), 0, `側${side}の件数`);
    assertEquals(result.memory.get(at + 8), 0x7f, `側${side}の集約状態`);
  }
  assertEquals(
    result.memory.has(work + start + 5 * recordSize + 8),
    false,
    "6本目",
  );
});

Deno.test("延ばした表は追加の分類の行だけを替え、他は原盤の番地の値を写す", () => {
  for (const table of categoryTables()) {
    const words = tableWords(table, (address) => address - table.source);
    assertEquals(words.length, ADDED_CATEGORY + 1, `${table.name}の件数`);
    assertEquals(words[0x48], 0x48 * 4, `${table.name}の0x48`);
    assertEquals(
      words[ADDED_CATEGORY],
      table.added >>> 0,
      `${table.name}の追加`,
    );
  }
});

Deno.test("名前の2つの表の追加の行は渡した画像の値になる。画像を渡さないときは原盤の値で代える", () => {
  const addedOf = (name: string, images?: FolderNameImages) =>
    categoryTables(images).find((table) => table.name === name)!.added;
  const images = { big: 0x5250069, label: 0xe1 };
  assertEquals(addedOf("名前", images), 0xe1, "名前");
  assertEquals(addedOf("大きな名前", images), 0x5250069, "大きな名前");
  assertEquals(addedOf("名前"), -1, "名前は描かない");
  assertEquals(addedOf("大きな名前"), 0x525006f, "大きな名前は分類0の画像");
});

Deno.test("追加フォルダーの枠は、そのレコードが表の後ろに来る最小の値", () => {
  for (
    const [tableEnd, recordSize] of [[0x10000, 0x100], [0x10001, 0x100], [
      0x3ed4c,
      0x3f0,
    ]]
  ) {
    const slot = addedFolderSlot(tableEnd, recordSize);
    const start = addedFolderStart(slot, recordSize);
    assertEquals(start >= tableEnd, true, "表の後ろ");
    assertEquals(
      addedFolderStart(slot - 1, recordSize) < tableEnd,
      true,
      "最小",
    );
  }
});
