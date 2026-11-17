/**
 * 選曲画面の版フォルダーを、曲DBの作品番号だけで決まるようにする。
 * 原盤は作品番号1の曲を、曲DB indexで2つの枠へ分けている。
 * 追加曲はその判定に当たらないので、どれも片方の枠へ入る。
 * 判定を潰すと、枠は作品番号+1だけで決まる。
 */

import type { PbVersions } from "@csa/core";
import { type MutableElf, overwriteCode } from "../../elf/mod.ts";
import { PB_SONG_COUNT, type SongContent } from "../../model/mod.ts";
import { type CsaSongDb, entryAddressOf, versionOf } from "./song_db.ts";

/** 曲DB indexで枠を分ける判定。3語を潰す */
const BRANCH = 0x20fb54;
const BRANCH_WORDS = 3;

/** 潰す判定が2つ目の枠へ入れていた曲DB index。原盤の振る舞いを曲DBへ写すのに使う */
const SECOND_FOLDER_SONGS = new Set([89, 90]);

export const pbVersionsOf = (
  { pbVersions }: Pick<SongContent, "pbVersions">,
): PbVersions =>
  new Map((pbVersions ?? []).map((each) => [each.songIndex, each.version]));

/**
 * 原盤の作品番号を新しい意味へ直す。`folder`を書いた曲は、その作品番号にする。
 * 判定が1つ目の枠へ入れていた曲は0になる。
 * 2つ目の枠へ入れていた2曲だけが1のまま残る。
 */
export const pbVersion = (
  version: number,
  songIndex: number,
  folders: PbVersions = new Map(),
): number =>
  folders.get(songIndex) ??
    (version === 1 && !SECOND_FOLDER_SONGS.has(songIndex) ? 0 : version);

/**
 * PB原盤の曲のエントリーの写しに、直した後の作品番号を書く。
 * 5鍵盤版の表がPBの曲なら、5鍵盤版はこの写しから作品番号を受け取る。
 * `writeVersionFolder`が直すのはPBの曲の枠だけなので、5鍵盤版の枠には直した値を先に書いておく
 */
export function withPbVersion(
  format: CsaSongDb["format"],
  entry: Uint8Array,
  songIndex: number,
  folders: PbVersions,
): Uint8Array {
  const out = entry.slice();
  const view = new DataView(out.buffer);
  const at = versionOf(format).offset;
  const fixed = pbVersion(view.getUint16(at, true), songIndex, folders);
  view.setUint16(at, fixed, true);
  return out;
}

/** `taken`は、表の曲を書いた PB の枠。書いた作品番号は CSA の並びなので、読み替えない */
export function writeVersionFolder(
  elf: MutableElf,
  songDb: CsaSongDb,
  folders: PbVersions,
  taken: ReadonlySet<number>,
): void {
  overwriteCode(elf, BRANCH, [], BRANCH_WORDS);
  const version = versionOf(songDb.format).offset;
  for (let song = 0; song < PB_SONG_COUNT; song++) {
    if (taken.has(song)) {
      continue;
    }
    const at = entryAddressOf(songDb, song) + version;
    elf.setU16(at, pbVersion(elf.u16(at), song, folders));
  }
}
