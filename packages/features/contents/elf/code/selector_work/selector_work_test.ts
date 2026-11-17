// 実行: CSA_PB_ELF=<原盤のELF> deno test --allow-read --allow-env=CSA_PB_ELF packages
// 1416曲・record容量4300の選曲ワーク拡張が、確かめた時点の結果のままであることを見る。
// 大きさを書く命令以外は旧生成器の出力と一致した。構造体の大きさは追加フォルダーの
// レコードのぶん旧生成器より大きいので、大きさを書く命令は別に確かめる。

import type { InstructionPatch } from "../../elf/mod.ts";
import { immOf } from "../mips/mod.ts";
import { parseSelectorWorkDirect } from "../instructions/tables/mod.ts";
import {
  assertPatchDigest,
  readElfPatchTable,
  testWithPbElf,
} from "../instructions/mod.ts";
import type { SongCapacity } from "../../model/mod.ts";
import { buildSelectorWorkPatches, selectorWorkLayout } from "./mod.ts";

const CAPACITY: SongCapacity = {
  abcCapacity: 13312,
  candidateListBytes: 1416 * 2 + 2,
  data1Capacity: 3072,
  itemCapacity: 4305,
  recordSize: 13312,
  records: 4300,
  saveCapacity: 2047,
  songCount: 1416,
  songDbCapacity: 1422,
};

const writesSize = (row: InstructionPatch) =>
  row.usage.includes("allocation") || row.usage.includes("appendZeroFill");

testWithPbElf("選曲ワークの拡張", (elf) => {
  const directGroups = parseSelectorWorkDirect(
    readElfPatchTable("selector_work_direct"),
  );
  const actual = buildSelectorWorkPatches(elf, CAPACITY, directGroups).rows;
  assertPatchDigest(
    actual,
    "b90c22acd1011390e050332a9fbc42a6402221df1023204fb62c9fedb855027a",
    "e_append",
  );

  // ゼロ埋めの長さも構造体の大きさにする。旧生成器は下位を終端レコードの位置と
  // ビット単位で混ぜ、構造体の外まで消していた
  const size = selectorWorkLayout(CAPACITY).structSize;
  for (const row of actual.filter(writesSize)) {
    const form = row.referenceForm.split(" + ")[0];
    const expected = form === "lui_hi" ? size >>> 16 : size & 0xffff;
    if ((immOf(row.newWord) & 0xffff) !== expected) {
      throw new Error(
        `0x${row.address.toString(16)}が構造体の大きさを表さない`,
      );
    }
  }
});
