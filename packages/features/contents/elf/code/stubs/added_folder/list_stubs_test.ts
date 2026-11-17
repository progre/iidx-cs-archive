// 一覧・表示可否・RANDOM・セレクトのスタブを小さなエミュレーターで実行し、分岐を確かめる。原盤は読まない。

import { reg } from "../../mips/mod.ts";
import {
  groupWords,
  listLoopWords,
  randomWords,
  selectWords,
} from "./list_stubs.ts";
import {
  ADDED_CATEGORY,
  GROUP_RETURN,
  GROUP_SITE,
  LIST_LOOPS,
  RANDOM_SITE,
  RANDOM_TAKEN,
  SELECT_FOLDER,
  SELECT_REST,
  SKIPPED_CATEGORY,
} from "./sites.ts";
import { runStub } from "./testing.ts";

const BASE = 0x7fb9000;

function assertEquals<T>(actual: T, expected: T, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label}: ${actual} != ${expected}`);
  }
}

Deno.test("一覧は前の分類の直後に追加の分類を挟み、並べない分類を除いて原盤の分類を一度ずつ見る", () => {
  const loop = LIST_LOOPS[0];
  const words = listLoopWords(loop);
  const order = [0];
  for (;;) {
    const current = order.at(-1)!;
    const result = runStub({
      base: BASE,
      regs: { [loop.counter]: current },
      words,
    });
    if (result.exit === loop.site + 16) break;
    assertEquals(result.exit, loop.top, `分類${current}の次はループの先頭`);
    order.push(result.regs[loop.counter]);
  }
  const expected = [
    ...Array.from({ length: 17 }, (_, i) => i),
    ADDED_CATEGORY,
    ...Array.from({ length: 0x3a - 17 }, (_, i) => i + 17)
      .filter((category) => category !== SKIPPED_CATEGORY),
  ];
  assertEquals(order, expected, "並び");
  // 原盤の一覧の容量0x3a(58件)を超えない
  assertEquals(order.length <= 0x3a, true, "件数");
});

Deno.test("グループは追加の分類をバージョン別の2にし、他は原盤へ戻す", () => {
  const words = groupWords();
  const run = (category: number) =>
    runStub({
      base: BASE,
      regs: { [reg.a1]: category, [reg.ra]: 0x1234 },
      words,
    });
  assertEquals(run(ADDED_CATEGORY).regs[reg.v0], 2, "追加の分類");
  assertEquals(run(ADDED_CATEGORY).exit, 0x1234, "呼び手へ戻る");
  assertEquals(run(0).exit, GROUP_RETURN, "分類0");
  assertEquals(run(5).exit, GROUP_SITE + 8, "他の分類");
});

Deno.test("RANDOMは0x39以下と追加の分類で置き、サブメニューの分類では置かない", () => {
  const words = randomWords();
  const run = (category: number, v1 = 0) =>
    runStub({
      base: BASE,
      regs: { [reg.s3]: category, [reg.v1]: v1, [reg.v0]: 3 },
      words,
    });
  assertEquals(run(0x10, 3).exit, RANDOM_SITE + 8, "v1が3");
  assertEquals(run(ADDED_CATEGORY).regs[reg.v0], 1, "追加の分類");
  assertEquals(run(0x39).regs[reg.v0], 1, "0x39");
  assertEquals(run(0x41).regs[reg.v0], 0, "サブメニュー");
  assertEquals(run(0x41).exit, RANDOM_TAKEN, "戻り先");
});

Deno.test("セレクトはバージョン別と追加の分類でフォルダー全体を替え、他は原盤の続きへ戻す", () => {
  const words = selectWords();
  const run = (category: number) =>
    runStub({ base: BASE, regs: { [reg.v1]: category }, words }).exit;
  assertEquals(run(0), SELECT_FOLDER, "分類0");
  assertEquals(run(0x10), SELECT_FOLDER, "分類0x10");
  assertEquals(run(ADDED_CATEGORY), SELECT_FOLDER, "追加の分類");
  assertEquals(run(0x11), SELECT_REST, "分類0x11");
  assertEquals(run(0x39), SELECT_REST, "分類0x39");
});
