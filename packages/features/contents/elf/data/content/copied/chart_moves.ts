/**
 * 曲の中で譜面を移す組(`chartMoves`)を、曲DBへ書く。
 * 裏の曲の組のうち、表の曲が持たない難易度へ移す組(`frontFills`)は、表の曲のその難易度を裏の曲の譜面で出す。
 * 裏を選んだ演奏では、stubが鳴らす曲を表の曲から裏の曲へ入れ替える。入れ替えても、選んだ難易度は変わらない。
 * そのため、裏の曲の中で欄を写してから、その欄を表の曲へも写す。移し元の欄は空にしない。
 * 選曲画面がどの欄を見て難易度を出すかは分かっていないので、レベル・ノーツ数・譜面・キー音・BGMをすべて写す。
 * ほかの組は、`moved_charts.ts`が曲の中で移し、移し元を空にする。
 */

import type { MutableElf } from "../../../elf/mod.ts";
import type { SongContent } from "../../../model/mod.ts";
import { type CsaSongDb, entryAddressOf } from "../song_db.ts";
import {
  type ChartAt,
  copyChart,
  fieldAddressesOf,
  fieldBytes,
  hasChart,
} from "./chart_fields.ts";
import {
  movedChartsOf,
  verifyMovedCharts,
  writeMovedCharts,
} from "./moved_charts.ts";

/** 裏の曲ごとに、表の曲にも写す組(`frontFills`)の、表の曲の難易度と、それを出す裏の曲の難易度 */
function frontFillsOf(content: SongContent) {
  // PB原盤の曲の写しの裏は、PBの枠(`songId`)に置いた表の曲の裏である
  const pbBacks = (content.pbBacks ?? []).map((back) => ({
    chartMoves: back.chartMoves,
    front: back.songId,
    frontFills: back.frontFills,
    index: back.targetSongIndex,
  }));
  return [
    ...content.songs.map((song) => ({
      chartMoves: song.variantOf?.chartMoves,
      front: song.variantOf?.targetSongIndex as number,
      frontFills: song.variantOf?.frontFills,
      index: song.targetSongIndex,
    })),
    ...pbBacks,
  ].flatMap(({ chartMoves, front, frontFills, index }) =>
    Object.entries(chartMoves ?? {})
      .filter(([name]) => frontFills?.includes(name))
      .map(([name, back]) => ({
        back: { index, name: back },
        front: { index: front, name },
      }))
  );
}

/**
 * 写した先の欄の仮想アドレスを返す。
 * 写した欄には、写し元の難易度の ABC index が入る。
 * 曲DBの ABC index を確かめる処理は、返したアドレスの欄を飛ばす。写した値は`verifyChartMoves`が確かめる
 */
export function copiedFieldAddresses(
  songDb: CsaSongDb,
  content: SongContent,
): Set<number> {
  const targets: ChartAt[] = [
    ...frontFillsOf(content).flatMap(({ back, front }) => [
      ...(back.name === front.name
        ? []
        : [{ index: back.index, name: front.name }]),
      front,
    ]),
    ...movedChartsOf(content).map(({ index, to }) => ({ index, name: to })),
  ];
  return new Set(
    targets.flatMap((chart) => fieldAddressesOf(songDb, chart)),
  );
}

/** 表の曲へ写したレベル欄の仮想アドレス */
export const frontFillLevelAddresses = (
  songDb: CsaSongDb,
  content: SongContent,
): Set<number> =>
  new Set(
    frontFillsOf(content).map(({ front }) =>
      entryAddressOf(songDb, front.index) +
      songDb.format.levelFieldOffset(front.name)
    ),
  );

/**
 * 表の曲が持たない難易度の組は、表の曲へ写す。表の曲がその難易度を持てば止める。
 * 表の曲が持つ難易度の組は、裏の曲の中で移す。
 * どちらの組も、裏の曲が写し元の難易度を持たなければ止める
 */
export function writeChartMoves(
  elf: MutableElf,
  songDb: CsaSongDb,
  content: SongContent,
): void {
  writeMovedCharts(elf, songDb, content);
  for (const { back, front } of frontFillsOf(content)) {
    const backAsFront = { index: back.index, name: front.name };
    if (hasChart(elf, songDb, front)) {
      throw new Error(`表の曲${front.index}は${front.name}を持つ`);
    }
    if (!hasChart(elf, songDb, back)) {
      throw new Error(`裏の曲${back.index}は${back.name}を持たない`);
    }
    if (back.name !== front.name) {
      if (hasChart(elf, songDb, backAsFront)) {
        throw new Error(`裏の曲${back.index}は${front.name}も持つ`);
      }
      copyChart(elf, songDb, back, backAsFront);
    }
    copyChart(elf, songDb, backAsFront, front);
  }
}

/** 表の曲の欄が、裏の曲の欄と同じ値かを見る */
export function verifyChartMoves(
  elf: MutableElf,
  songDb: CsaSongDb,
  content: SongContent,
): void {
  for (const { back, front } of frontFillsOf(content)) {
    const expected = fieldBytes(elf, songDb, {
      index: back.index,
      name: front.name,
    });
    const same = fieldBytes(elf, songDb, front).every((bytes, i) =>
      bytes.every((byte, j) => byte === expected[i][j])
    );
    if (!same) {
      throw new Error(`表の曲${front.index}の${front.name}の欄が読み戻せない`);
    }
  }
  const fronts = frontFillsOf(content).map(({ front }) => front);
  verifyMovedCharts(
    elf,
    songDb,
    content,
    (index, name) =>
      fronts.some((front) => front.index === index && front.name === name),
  );
}
