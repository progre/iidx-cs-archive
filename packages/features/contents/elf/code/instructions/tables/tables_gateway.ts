// `data/elf_patch/`のTSVを読む。TSVには、解析で分類した命令の一覧が入っている。
// 読んだ文字列は`tables.ts`が表にする。CSAのELFを作る関数は、その表を受け取る。

import type { ElfPatchTables } from "../../../model/mod.ts";
import {
  parseAddressTable,
  parseSaveDataReferences,
  parseSelectorWorkDirect,
  parseSongValueSites,
} from "./tables.ts";

const DIRECTORY = "data/elf_patch/";

const read = (name: string) => Deno.readTextFileSync(DIRECTORY + name + ".tsv");

export const readElfPatchTables = (): ElfPatchTables => ({
  saveDataReferences: parseSaveDataReferences(read("save_data_references")),
  selectionItemLbu: parseAddressTable(read("selection_item_lbu")),
  selectorWorkDirect: parseSelectorWorkDirect(read("selector_work_direct")),
  songCountImmediates: parseAddressTable(read("song_count_immediates")),
  songValueSites: parseSongValueSites(read("song_value_sites")),
});
