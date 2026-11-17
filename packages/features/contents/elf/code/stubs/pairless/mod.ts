// 組を持たない曲の判定・読み込みを表引きへ差し替える。

import { type MutableElf, overwriteCode } from "../../../elf/mod.ts";
import { j, NOP } from "../../mips/mod.ts";
import type { PairlessSong, SongContent } from "../../../model/mod.ts";
import { wordsOf, writeSlot } from "../area.ts";
import { loaderWords, matcherWords } from "./stub.ts";
import {
  DESCRIPTOR_POINTER_ADDR,
  DESCRIPTOR_SLOT,
  descriptorAddress,
  descriptorBytes,
  DESCRIPTORS,
  LOAD_SLOT,
  LOAD_STUB,
  LOADER_SITE,
  LOADER_SITE_WORDS,
  MATCH_SLOT,
  MATCH_STUB,
  MATCHER_HEAD,
  MATCHER_HEAD_WORDS,
  PACKAGE_TABLE_ADDR,
  type PairlessRow,
  readRows,
  TABLE_SLOT,
  tableBytes,
} from "./table.ts";

/** 原盤が既定で持つ1曲ぶんの行。判定関数の即値と、2つの表の現在値から作る */
function defaultRow(elf: MutableElf): PairlessRow {
  return {
    descriptor: elf.u32(DESCRIPTOR_POINTER_ADDR),
    packageIndex: elf.u32(PACKAGE_TABLE_ADDR),
    songIndex: elf.u32(MATCHER_HEAD) & 0xffff,
  };
}

/** 表と同じ曲DB indexの昇順で返す。書いた行と読み戻した行を突き合わせるため */
function rowsOf(
  elf: MutableElf,
  songs: readonly PairlessSong[],
): PairlessRow[] {
  return [
    defaultRow(elf),
    ...songs.map((song, index) => ({
      descriptor: descriptorAddress(index),
      packageIndex: song.packageIndex,
      songIndex: song.songIndex,
    })),
  ].sort((a, b) => a.songIndex - b.songIndex);
}

/**
 * 追加0件でも常に当てる。
 * 追加0件の表は既定の1行だけになる。
 * そのため、挙動は原盤と同じになる。
 */
export function writePairless(elf: MutableElf, content: SongContent): void {
  const songs = content.pairlessSongs ?? [];
  // 既定行の曲DB indexは判定関数の即値から採る。
  // この後の差し替えで即値は潰れる。
  // そのため、書けたことの確認もここで行う。
  const rows = rowsOf(elf, songs);
  writeSlot(
    elf,
    DESCRIPTOR_SLOT,
    wordsOf(descriptorBytes(songs.map((song) => song.descriptor))),
  );
  writeSlot(elf, TABLE_SLOT, wordsOf(tableBytes(rows)));
  writeSlot(elf, MATCH_SLOT, matcherWords());
  writeSlot(elf, LOAD_SLOT, loaderWords());
  overwriteCode(elf, MATCHER_HEAD, [j(MATCH_STUB)], MATCHER_HEAD_WORDS);
  overwriteCode(elf, LOADER_SITE, [j(LOAD_STUB)], LOADER_SITE_WORDS);
  const written = readRows(elf).slice(0, -1);
  if (JSON.stringify(written) !== JSON.stringify(rows)) {
    throw new Error("組を持たない曲の表が書けていない");
  }
}

/**
 * 表の行を検査する。
 * 既定行の曲DB indexの元になる即値は、書き換えで潰れている。
 * そのため、ここでは追加分に一致しない残り1行を既定行とみなす。
 * 即値と一致することは`writePairless`が書いた直後に確かめている。
 */
function verifyTableRows(
  elf: MutableElf,
  songs: readonly PairlessSong[],
): void {
  const rows = readRows(elf);
  const terminator = rows.at(-1);
  if (terminator === undefined || terminator.songIndex !== -1) {
    throw new Error("組を持たない曲の表が終端していない");
  }
  const body = rows.slice(0, -1);
  if (body.length !== songs.length + 1) {
    throw new Error("組を持たない曲の表の行数が合わない");
  }
  const sorted = [...body].sort((a, b) => a.songIndex - b.songIndex);
  if (JSON.stringify(body) !== JSON.stringify(sorted)) {
    throw new Error("組を持たない曲の表が昇順でない");
  }
  const additionIndices = new Set(songs.map((song) => song.songIndex));
  songs.forEach((song, index) => {
    const row = body.find((candidate) =>
      candidate.songIndex === song.songIndex
    );
    if (row === undefined) {
      throw new Error(`組を持たない曲の表に曲DB index ${song.songIndex}が無い`);
    }
    if (
      row.packageIndex !== song.packageIndex ||
      row.descriptor !== descriptorAddress(index)
    ) {
      throw new Error(
        `組を持たない曲の表の曲DB index ${song.songIndex}行が違う`,
      );
    }
  });
  const defaults = body.filter((row) => !additionIndices.has(row.songIndex));
  if (defaults.length !== 1) {
    throw new Error("組を持たない曲の表に既定行が無い");
  }
  const [defaultActual] = defaults;
  if (
    defaultActual.packageIndex !== elf.u32(PACKAGE_TABLE_ADDR) ||
    defaultActual.descriptor !== elf.u32(DESCRIPTOR_POINTER_ADDR)
  ) {
    throw new Error("組を持たない曲の表の既定行が原盤と違う");
  }
}

export function verifyPairless(elf: MutableElf, content: SongContent): void {
  const songs = content.pairlessSongs ?? [];
  if (elf.u32(MATCHER_HEAD) !== j(MATCH_STUB)) {
    throw new Error("組を持たない曲の判定の呼び出しが書けていない");
  }
  if (elf.u32(LOADER_SITE) !== j(LOAD_STUB)) {
    throw new Error("組を持たない曲の読み込みの呼び出しが書けていない");
  }
  for (let index = 1; index < LOADER_SITE_WORDS; index++) {
    if (elf.u32(LOADER_SITE + index * 4) !== NOP) {
      throw new Error("組を持たない曲の読み込みに元の命令が残っている");
    }
  }
  matcherWords().forEach((word, index) => {
    if (elf.u32(MATCH_STUB + index * 4) !== word) {
      throw new Error(`組を持たない曲の判定stubの${index}語目が書けていない`);
    }
  });
  loaderWords().forEach((word, index) => {
    if (elf.u32(LOAD_STUB + index * 4) !== word) {
      throw new Error(
        `組を持たない曲の読み込みstubの${index}語目が書けていない`,
      );
    }
  });
  verifyTableRows(elf, songs);
  wordsOf(descriptorBytes(songs.map((song) => song.descriptor))).forEach(
    (word, index) => {
      if (elf.u32(DESCRIPTORS + index * 4) !== word) {
        throw new Error(`組を持たない曲の記述子の${index}語目が書けていない`);
      }
    },
  );
}
