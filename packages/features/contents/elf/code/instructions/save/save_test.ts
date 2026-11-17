// 実行: CSA_PB_ELF=<原盤のELF> deno test --allow-read --allow-env=CSA_PB_ELF packages
// 曲容量1536のセーブ配置が、emp側の表を重ねた時点の結果のままであることを見る。

import { assertEquals } from "@std/assert";
import { parseSaveDataReferences } from "../tables/mod.ts";
import {
  assertPatchDigest,
  readElfPatchTable,
  testWithPbElf,
} from "../testing.ts";
import { makeSaveLayout } from "./layout.ts";
import { buildSaveLayoutPatches } from "./mod.ts";

const SAVE_CAPACITY = 1536;

Deno.test("emp側の表はPB側の表と同じ位置に重ねる", () => {
  const layout = makeSaveLayout(SAVE_CAPACITY);
  assertEquals(layout.starts.get("tableA"), layout.starts.get("tableB"));
  assertEquals(layout.starts.get("tableC"), layout.starts.get("tableD"));
  assertEquals(layout.starts.get("cacheE"), layout.starts.get("cacheF"));
  // 表B・byte表・表D・補助byte表の曲あたり998バイトと、保存scalar
  assertEquals(layout.saveSize, 998 * SAVE_CAPACITY + 0x10);
});

testWithPbElf("セーブデータの配置", (elf) => {
  const references = parseSaveDataReferences(
    readElfPatchTable("save_data_references"),
  );
  assertPatchDigest(
    buildSaveLayoutPatches(elf, SAVE_CAPACITY, references),
    "118a927f66bbb7a8d1635db0432d3a4d24d079ed538e23532cef96807d549171",
    "save_layout",
  );
});
