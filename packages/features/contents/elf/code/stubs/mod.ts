/**
 * stub領域へ置くバイト列と、追加コードの書き込み。
 * 曲数から決まるぶん(`writeBaseStubs`)と、収録内容から決まるぶん(`writeContentStubs`)に
 * 分かれる。
 */

import type { MutableElf } from "../../elf/mod.ts";
import type { SongContent } from "../../model/mod.ts";
import { STUB_SLOTS } from "../../data/stub_area/mod.ts";
import { wordsOf, writeSlot } from "./area.ts";
import {
  type SongDbAddress,
  verifyBgmOverride,
  writeBgmOverride,
} from "./bgm_override/mod.ts";
export { verifyAddedFolder, writeAddedFolder } from "./added_folder/mod.ts";
import { verifyFiveKeys, writeFiveKeys } from "./five_keys/mod.ts";
import {
  verifyExtraImageSetLoad,
  writeExtraImageSetLoad,
} from "./image_set_load.ts";
import { writeLoaderStubs } from "./loader.ts";
import {
  verifyOverlaySwitch,
  writeOverlaySwitch,
} from "./overlay_switch/mod.ts";
import { verifyPairless, writePairless } from "./pairless/mod.ts";

export type { SongDbAddress } from "./bgm_override/mod.ts";

/** セーブのディレクトリ名。原盤の名前の後ろにCSAの印を足す */
const SAVE_DIRECTORY_NAME = 0x26fac0;
const SAVE_DIRECTORY_BYTES = 0x20;
const CSA_SUFFIX = "CSA";

function writeSaveDirectoryName(elf: MutableElf): void {
  const current = elf.slice(SAVE_DIRECTORY_NAME, SAVE_DIRECTORY_BYTES);
  const end = current.indexOf(0);
  if (end < 0) throw new Error("セーブのディレクトリ名が終端しない");
  const name = new TextDecoder().decode(current.subarray(0, end)) + CSA_SUFFIX;
  const bytes = new Uint8Array(SAVE_DIRECTORY_BYTES);
  bytes.set(new TextEncoder().encode(name));
  if (bytes.at(SAVE_DIRECTORY_BYTES - 1) !== 0) {
    throw new Error("セーブのディレクトリ名が確保領域を超える");
  }
  elf.setBytes(SAVE_DIRECTORY_NAME, bytes);
}

/** 曲値16bit化のstub本体、既定の解禁一覧、セーブのディレクトリ名を置く */
export function writeBaseStubs(
  elf: MutableElf,
  songValueStubs: Uint8Array,
  unlockList: Uint8Array,
): void {
  writeSlot(elf, STUB_SLOTS.songValue, wordsOf(songValueStubs));
  writeSlot(elf, STUB_SLOTS.unlock, wordsOf(unlockList));
  writeSaveDirectoryName(elf);
}

/** 収録内容から決まる追加コードと、それが引く表 */
export function writeContentStubs(
  elf: MutableElf,
  content: SongContent,
  abcVaddr: number,
  extraImageSets: readonly number[],
  songDb: SongDbAddress,
): void {
  writeExtraImageSetLoad(elf, extraImageSets);
  writeLoaderStubs(elf, abcVaddr);
  writeBgmOverride(elf, content, songDb);
  writeOverlaySwitch(elf, content);
  writeFiveKeys(elf, content);
  writePairless(elf, content);
}

export function verifyContentStubs(
  elf: MutableElf,
  content: SongContent,
  extraImageSets: readonly number[],
  songDb: SongDbAddress,
): void {
  verifyExtraImageSetLoad(elf, extraImageSets);
  verifyBgmOverride(elf, content, songDb);
  verifyOverlaySwitch(elf, content);
  verifyFiveKeys(elf, content);
  verifyPairless(elf, content);
}
export { writeSlot } from "./area.ts";
