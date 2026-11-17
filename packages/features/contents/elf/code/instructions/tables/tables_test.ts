// 実行: deno test --allow-read=. packages
// `data/elf_patch/`の5つの表が読めて、件数が解析記録と揃っていることを見る。

import {
  parseAddressTable,
  parseSaveDataReferences,
  parseSelectorWorkDirect,
  parseSongValueSites,
} from "./tables.ts";
import { readElfPatchTable } from "../testing.ts";

function assertCount(actual: number, expected: number, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: ${actual}件、${expected}件ではない`);
  }
}

Deno.test("選曲項目コードを読むlbの表", () => {
  const rows = parseAddressTable(readElfPatchTable("selection_item_lbu"));
  assertCount(rows.length, 29, "selection_item_lbu");
});

Deno.test("曲数を判定する即値の表", () => {
  const rows = parseAddressTable(readElfPatchTable("song_count_immediates"));
  assertCount(rows.length, 137, "song_count_immediates");
});

Deno.test("セーブデータの参照箇所の表", () => {
  const rows = parseSaveDataReferences(
    readElfPatchTable("save_data_references"),
  );
  assertCount(rows.length, 472, "save_data_references");
});

Deno.test("曲値を触るsiteの表", () => {
  const rows = parseSongValueSites(readElfPatchTable("song_value_sites"));
  assertCount(rows.length, 268, "song_value_sites");
});

Deno.test("選曲ワークを触る命令の許可一覧", () => {
  const groups = parseSelectorWorkDirect(
    readElfPatchTable("selector_work_direct"),
  );
  assertCount(groups.length, 96, "selector_work_direct のグループ");
  assertCount(
    groups.reduce((sum, group) => sum + group.sites.length, 0),
    845,
    "selector_work_direct の命令",
  );
});
