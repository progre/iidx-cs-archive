// PB形式の曲DBエントリから、曲リストの行が使う値を読む。

import type { ListEntry } from "@csa/core";
import { versionByteOf, versionFolder } from "../version/mod.ts";
import type { PbEntryFormat } from "./format/mod.ts";

/** エントリの作品番号の欄から決まる枠 */
export const entryFolderOf = (
  format: PbEntryFormat,
  entry: Uint8Array,
): number => versionFolder(versionByteOf(format.recordOf(entry)));

/** `folder`は収録フォルダーの枠。PB原盤の曲は、作品番号をCSAの番号に置き換えてから渡す */
export function listEntryOf(
  format: PbEntryFormat,
  entry: Uint8Array,
  folder: number,
): ListEntry {
  const record = format.recordOf(entry);
  return {
    folder,
    levels: format.levelsOf(record),
    notes: format.noteCountsOf(record),
    // 実機は、題名のバイトの値を先頭から比べて並べる。
    // この並びキーも、バイトの値をそのまま文字の番号にして作る。
    sortKey: String.fromCharCode(...record.title.bytes),
    videoAbcIndex: record.video.primary[0],
  };
}
