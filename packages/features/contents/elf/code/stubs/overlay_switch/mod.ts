/**
 * オーバーレイをANOTHERのときだけ使う曲を、演奏中に難易度を見て切り替える。
 * PBの`0x1dea40`の頭を、stubへの`j`に置き換える。
 * 該当する曲が無い構成では何もしない。
 */

import { type MutableElf, overwriteCode } from "../../../elf/mod.ts";
import { j, NOP } from "../../mips/mod.ts";
import type { SongContent } from "../../../model/mod.ts";
import { STUB_SLOTS } from "../../../data/stub_area/mod.ts";
import { writeSlot } from "../area.ts";
import {
  overlaySwitchStubWords,
  overlaySwitchTableWords,
  PB_OVERLAY,
} from "./stub.ts";

const CODE_SLOT = STUB_SLOTS.overlaySwitchCode;
const TABLE_SLOT = STUB_SLOTS.overlaySwitchTable;

/** 置き換える頭の語数。`j`と遅延スロット */
const HEAD_WORDS = 2;

const switchedSongs = (content: SongContent): number[] =>
  content.songs.filter((song) => song.overlayOnlyAnother)
    .map((song) => song.targetSongIndex);

/** `jal`の語から呼び先を取り出す */
function jalTarget(word: number): number {
  if (word >>> 26 !== 3) {
    throw new Error(`0x${PB_OVERLAY.indexCall.toString(16)}が jal でない`);
  }
  return ((word & 0x3ffffff) << 2) >>> 0;
}

/**
 * stubの置き場と表の置き場の中身を組む。
 * stubは、`0x1dea48`の`jal`の呼び先を呼んで曲indexを得る。
 * 裏エントリーを持つ構成では、`writeBgmOverride`がこの呼び先を差し替えている。
 * そのため、裏を選んだ演奏では裏の曲indexが得られる
 */
const slotWords = (elf: MutableElf, songs: readonly number[]) =>
  [
    [
      CODE_SLOT,
      overlaySwitchStubWords(
        jalTarget(elf.u32(PB_OVERLAY.indexCall)),
        TABLE_SLOT.vaddr,
      ),
    ],
    [TABLE_SLOT, overlaySwitchTableWords(songs)],
  ] as const;

/** 曲indexの差し替え(`writeBgmOverride`)を書いた後に呼ぶ */
export function writeOverlaySwitch(
  elf: MutableElf,
  content: SongContent,
): void {
  const songs = switchedSongs(content);
  if (songs.length === 0) return;
  for (const [slot, words] of slotWords(elf, songs)) {
    writeSlot(elf, slot, words);
  }
  overwriteCode(elf, PB_OVERLAY.exists, [j(CODE_SLOT.vaddr), NOP], HEAD_WORDS);
}

export function verifyOverlaySwitch(
  elf: MutableElf,
  content: SongContent,
): void {
  const songs = switchedSongs(content);
  if (songs.length === 0) return;
  if (
    elf.u32(PB_OVERLAY.exists) !== j(CODE_SLOT.vaddr) ||
    elf.u32(PB_OVERLAY.exists + 4) !== NOP
  ) {
    throw new Error("オーバーレイの切り替えへの分岐が書けていない");
  }
  for (const [slot, words] of slotWords(elf, songs)) {
    words.forEach((word, index) => {
      if (elf.u32(slot.vaddr + index * 4) !== word) {
        throw new Error(
          `オーバーレイの切り替えの${slot.name}の${index}語目が書けていない`,
        );
      }
    });
  }
}
