// 選曲画面のバージョン別フォルダー。曲DBの作品番号から枠を決める。
// 枠の選び方は、実機の振り分け処理が持つ規則に合わせる。

import type { SongDbRecord } from "../record/mod.ts";

/** 実機は作品番号の欄を1バイトで読むので、ここも同じ読み方にする */
export const versionByteOf = (record: SongDbRecord): number =>
  (record.selection.origin ?? 0) & 0xff;

/**
 * 曲が入るバージョン別フォルダーの枠。原盤は作品番号1の曲だけ曲DB indexで枠を分けていたが、
 * 配置器がその判定を潰すので`値 + 1`の1本になる(`core/version_folder_patch.ts`)
 */
export const versionFolder = (version: number): number => version + 1;

/**
 * 枠の略号。曲リストの表にも収録表にもこの綴りで書く。
 * 当てはまるACの作品名は原盤から確かめられないので持たない
 */
const FOLDERS = [
  "1st",
  "sub",
  "2nd",
  "3rd",
  "4th",
  "5th",
  "6th",
  "7th",
  "8th",
  "9th",
  "10th",
  "red",
  "hs",
  "dd",
  "gold",
  "djt",
  "emp",
  "sir",
];

/** 分からない枠は`?`を出す */
export const folderShort = (folder: number): string =>
  FOLDERS[folder - 1] ?? "?";

/** 全曲リストの`folder`列の略号から作品番号を引く */
export function versionOfFolderName(name: string): number {
  const folder = FOLDERS.indexOf(name.trim().toLowerCase()) + 1;
  if (folder === 0) throw new Error(`未知のフォルダー名: ${name}`);
  return folder - 1;
}
