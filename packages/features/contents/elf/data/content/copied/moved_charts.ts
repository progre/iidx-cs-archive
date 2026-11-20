/**
 * 曲の中で譜面を移す組(`chartMoves`)のうち、表の曲へ写さない組。
 * 裏の曲では、表の曲が左の難易度を持つ組である。表の曲では、表の曲の行に書いたすべての組である。
 * 右の難易度の譜面を左の難易度へ移し、右の難易度を空にする。
 */

import type { MutableElf } from "../../../elf/mod.ts";
import type { SongContent } from "../../../model/mod.ts";
import { type CsaSongDb, entryAddressOf } from "../song_db.ts";
import { fieldBytes, fieldsOf, hasChart } from "./chart_fields.ts";

/** 曲の中で譜面を移し、右の難易度を空にする組。裏の曲では、`to`は表の曲が持つ難易度である */
export function movedChartsOf(content: SongContent) {
  // 表の曲の行に書いた組は、表の曲の中で移す
  return content.songs.flatMap((song) => {
    const fills = song.variantOf?.frontFills ?? [];
    const backMoves = Object.entries(song.variantOf?.chartMoves ?? {})
      .filter(([to]) => !fills.includes(to));
    return Object.entries({
      ...Object.fromEntries(backMoves),
      ...song.chartMoves,
    }).map(([to, from]) => ({
      from,
      index: song.targetSongIndex,
      to,
    }));
  });
}

type Move = ReturnType<typeof movedChartsOf>[number];

const isTarget = (moves: readonly Move[], index: number, name: string) =>
  moves.some((move) => move.index === index && move.to === name);

/**
 * 組の移し先は、裏の曲が持たない難易度か、別の組の移し元でなければならない。
 * 移し元は、別の組の移し先でなければ空にする。
 * 空にするのは、レベルとノーツ数の欄だけである。裏の候補は、レベル欄だけで決まる。
 * 譜面と音の欄は ABC index を持つので、残す
 */
export function writeMovedCharts(
  elf: MutableElf,
  songDb: CsaSongDb,
  content: SongContent,
): void {
  const moves = movedChartsOf(content);
  const isSource = (index: number, name: string) =>
    moves.some((move) => move.index === index && move.from === name);
  // 移し先が別の組の移し元になることがあるので、書く前に移し元をすべて控える
  const sources = moves.map(({ from, index, to }) => {
    if (!hasChart(elf, songDb, { index, name: from })) {
      throw new Error(`裏の曲${index}は${from}を持たない`);
    }
    if (hasChart(elf, songDb, { index, name: to }) && !isSource(index, to)) {
      throw new Error(`裏の曲${index}は${to}も持つ`);
    }
    return fieldBytes(elf, songDb, { index, name: from })
      .map((bytes) => Uint8Array.from(bytes));
  });
  moves.forEach(({ index, to }, i) =>
    fieldsOf(songDb, to).forEach(({ offset }, j) =>
      elf.setBytes(entryAddressOf(songDb, index) + offset, sources[i][j])
    )
  );
  const { format } = songDb;
  for (const { from, index } of moves) {
    if (isTarget(moves, index, from)) {
      continue;
    }
    const cleared = [
      { bytes: 1, offset: format.levelFieldOffset(from) },
      ...format.notesFieldOffsets(from).map((offset) => ({ bytes: 2, offset })),
    ];
    for (const { bytes, offset } of cleared) {
      elf.setBytes(
        entryAddressOf(songDb, index) + offset,
        new Uint8Array(bytes),
      );
    }
  }
}

/**
 * 移し先が譜面を持ち、空にした移し元が譜面を持たないかを見る。
 * `refilled`は、移した後で裏の曲の譜面を写した表の曲の欄である。この欄は空にした移し元でも譜面を持つ
 */
export function verifyMovedCharts(
  elf: MutableElf,
  songDb: CsaSongDb,
  content: SongContent,
  refilled: (index: number, name: string) => boolean,
): void {
  const moves = movedChartsOf(content);
  for (const { from, index, to } of moves) {
    const sourceLeft = !isTarget(moves, index, from) &&
      !refilled(index, from) &&
      hasChart(elf, songDb, { index, name: from });
    if (!hasChart(elf, songDb, { index, name: to }) || sourceLeft) {
      throw new Error(`裏の曲${index}の${to}へ移した譜面が読み戻せない`);
    }
  }
}
