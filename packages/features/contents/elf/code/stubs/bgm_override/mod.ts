/**
 * 設定関数に残る「戻り値を捨てるモード判定2呼び出し」を、stubへの`jal`へ置き換える。
 * stubと表は、高位PT_LOADの追加コード領域へ書く。
 * 呼び出し位置から最初に呼ぶのは、全曲リストで足した組のstubである。
 * 今の曲がその表に無ければ、原作の組のstubへ飛ぶ。
 */

import { type MutableElf, overwriteCode } from "../../../elf/mod.ts";
import { jal, NOP } from "../../mips/mod.ts";
import type { SongContent } from "../../../model/mod.ts";
import { wordsOf, writeSlot } from "../area.ts";
import {
  LIST_CODE_SLOT,
  LIST_STUB,
  LIST_TABLE_SLOT,
  listRows,
  listStubWords,
  listTableBytes,
  type SongDbAddress,
} from "./list/mod.ts";
import {
  redirectSongIndex,
  SONG_INDEX_SLOT,
  songIndexStubWords,
  verifySongIndexRedirect,
} from "./song_index.ts";
import { bgmOverrideStubWords } from "./stub.ts";
import {
  CODE_SLOT,
  SEED_INITIAL,
  SEED_SLOT,
  STUB_CODE,
  TABLE_SLOT,
  variantRows,
  variantTableBytes,
} from "./table.ts";

export type { SongDbAddress } from "./list/mod.ts";

/** empが上書き曲indexを書いていた位置。原盤には呼び出しだけが残る */
const SITE = 0x1f2140;
/** 潰す語数。モード判定2呼び出しと、その間の分岐まで */
const SITE_WORDS = 6;

const hasVariants = (content: SongContent) =>
  variantRows(content).length > 0 || listRows(content).length > 0;

/**
 * 新しい組のstubは、表にある曲では原作の組のstubへ飛ばない。
 * そのため、原作の組の表の曲や、直前の曲(`trigger`)と重なると、原作の規則が働かなくなる
 */
function assertNoOverlap(content: SongContent): void {
  const original = new Set(
    variantRows(content).flatMap((row) => [row.front, row.trigger]),
  );
  const overlaps = listRows(content).filter((row) => original.has(row.front));
  if (overlaps.length > 0) {
    throw new Error(
      `原作の組と、全曲リストで足した組の表の曲が重なる: 曲index ${
        overlaps.map((row) => row.front).join(", ")
      }`,
    );
  }
}

/** 置き場ごとの語。書くときと読み戻すときで同じものを使う */
const slotWords = (content: SongContent, songDb: SongDbAddress) =>
  [
    [LIST_CODE_SLOT, listStubWords(songDb, STUB_CODE)],
    [LIST_TABLE_SLOT, wordsOf(listTableBytes(content))],
    [CODE_SLOT, bgmOverrideStubWords()],
    // 種の次の語は、上書き曲indexを書いたときの表の曲index。まだ書いていないので`-1`
    [SEED_SLOT, [SEED_INITIAL, -1 >>> 0]],
    [SONG_INDEX_SLOT, songIndexStubWords()],
    [TABLE_SLOT, wordsOf(variantTableBytes(content))],
  ] as const;

/** 裏エントリーを持たない構成では何もしない */
export function writeBgmOverride(
  elf: MutableElf,
  content: SongContent,
  songDb: SongDbAddress,
): void {
  if (!hasVariants(content)) return;
  assertNoOverlap(content);
  for (const [slot, words] of slotWords(content, songDb)) {
    writeSlot(elf, slot, words);
  }
  overwriteCode(elf, SITE, [jal(LIST_STUB)], SITE_WORDS);
  redirectSongIndex(elf);
}

export function verifyBgmOverride(
  elf: MutableElf,
  content: SongContent,
  songDb: SongDbAddress,
): void {
  if (!hasVariants(content)) return;
  if (elf.u32(SITE) !== jal(LIST_STUB)) {
    throw new Error("BGM差し替えの呼び出しが書けていない");
  }
  for (let index = 1; index < SITE_WORDS; index++) {
    if (elf.u32(SITE + index * 4) !== NOP) {
      throw new Error("BGM差し替えの置換位置に元の命令が残っている");
    }
  }
  verifySongIndexRedirect(elf);
  for (const [slot, words] of slotWords(content, songDb)) {
    words.forEach((word, index) => {
      if (elf.u32(slot.vaddr + index * 4) !== word) {
        throw new Error(
          `BGM差し替えの${slot.name}の${index}語目が書けていない`,
        );
      }
    });
  }
}
