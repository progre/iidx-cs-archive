// 各曲のSP・DPの譜面ごとのノーツ数を、世代・曲のキー・sb〜dlのTSVで標準出力へ出す。
// キーは全曲リストの`title`列と同じ形で、譜面が無い難易度は空にする。
// 譜面は曲DBの値から引いた番号で、原盤から読んで平文にする。引き方は locate.ts。
// 平文譜面が無いスロットは空にして、標準エラーへ報告する。出力の読み方は README.md。
//
// 実行: deno run --allow-read=. packages/utils/chart_notes/main.ts \
//   [--generation <世代>]

import { parseArgs } from "@std/cli/parse-args";
import { readDiscFolders } from "@csa/containers-disc";
import { type PlainCharts, statsOfChart } from "@csa/contents-chart";
import {
  readElves,
  readPlainCharts,
  songmapOfGeneration,
} from "./source_read.ts";
import { SongDb } from "@csa/contents-song-db";
import {
  chartFileIndices,
  chartFormatOf,
  chartSlotsOf,
  type Definition,
  DEFINITIONS,
} from "@csa/selection-definitions";
import {
  type Chart,
  chartOfName,
  CHARTS,
  type DbSong,
  songKey,
} from "@csa/selection-song-catalog";
import type { ChartFormat } from "@csa/core";

// 曲DBの譜面の値から、平文譜面の番号を引く。値の形は世代で3通りある。
// - ELFの中の譜面(3rd〜6th): 値は仮想アドレスで、番号は曲順・スロット順の連番になる
// - 上位4ビットが0xFの値(7th・8th): 下位に、ファイル表の2番目のアーカイブの件数を足す
// - それ以外(9th以降): 値がそのまま番号になる

const NO_CHART_VALUES = [0, 0xffffffff];
const INDEX_MASK = 0x0fffffff;
const FLAGGED = 0xf;

export interface ChartSource {
  /** 譜面がELFの中にあるなら真。値はELFの仮想アドレスになる */
  areElfPointers: boolean;
  /** ELFの中の譜面の連番の先頭。譜面のファイルの最小の番号 */
  firstSerial: number;
  /** 上位4ビットが0xFの値に足す番号。ファイル表の2番目のアーカイブの件数 */
  flaggedShift: number;
}

/** 曲ごと・スロットごとの平文譜面の番号。譜面が無いスロットはnull */
export function plainIndicesOf(
  filesBySong: number[][],
  source: ChartSource,
): (number | null)[][] {
  let serial = source.firstSerial;
  return filesBySong.map((files) =>
    files.map((value) => {
      if (NO_CHART_VALUES.includes(value)) {
        return null;
      }
      if (source.areElfPointers) {
        return serial++;
      }
      const shift = value >>> 28 === FLAGGED ? source.flaggedShift : 0;
      return (value & INDEX_MASK) + shift;
    })
  );
}

// 曲DBの譜面スロットの並びを、全曲リストの譜面名へ直してノーツ数を数え、出力の1行にする。
// 出力の列は全曲リストの難易度の列と同じ並びで、キーは`title`列と同じ形にする。
export const OUTPUT_HEADER = ["generation", "title", ...CHARTS].join("\t");

export function outputLine(
  generation: string,
  title: string,
  counts: Partial<Record<Chart, number>>,
): string {
  const values = CHARTS.map((chart) => counts[chart]?.toString() ?? "");
  return [generation, title, ...values].join("\t");
}

/** 1曲ぶんのノーツ数。DPは1Pと2Pの合計で、譜面が無い難易度は持たない */
export function noteCountsOf(
  charts: (Uint8Array | null)[],
  format: ChartFormat,
  slotCharts: Chart[],
): Partial<Record<Chart, number>> {
  const entries = charts.flatMap((bytes, slot) => {
    const chart = slotCharts.at(slot);
    if (bytes == null || chart == null) {
      return [];
    }
    return [[chart, statsOfChart(bytes, format).total] as const];
  });
  return Object.fromEntries(entries);
}

async function linesOf(
  definition: Definition,
  elf: Uint8Array,
): Promise<string[]> {
  const { generation } = definition;
  const db = new SongDb(elf, definition.elf);
  const songs: DbSong[] = Array.from(
    { length: db.length },
    (_, songId) => ({ songId, title: db.record(songId).title.text }),
  );
  const charts: PlainCharts = await readPlainCharts(generation, elf);
  const { areElfPointers } = definition.elf.songDbRecordLayout.chart;
  const indices = plainIndicesOf(
    songs.map((song) => db.record(song.songId).chart.files),
    {
      areElfPointers,
      firstSerial: Math.min(
        ...chartFileIndices(songmapOfGeneration(generation, elf).files),
      ),
      flaggedShift: definition.elf.fileTable.archives.at(1)?.count ?? 0,
    },
  );
  return songs.map((song) => {
    const bytes = indices[song.songId].map((index, slot) => {
      const found = index == null ? null : charts.get(index) ?? null;
      if (index != null && found == null) {
        console.error(
          `${generation} song${song.songId} slot${slot}: no plain chart (${index})`,
        );
      }
      return found;
    });
    const counts = noteCountsOf(
      bytes,
      chartFormatOf(generation),
      chartSlotsOf(generation).map(chartOfName),
    );
    return outputLine(generation, songKey(song, songs), counts);
  });
}

async function main() {
  const args = parseArgs(Deno.args, { string: ["generation"] });
  const discs = readDiscFolders();
  const definitions = DEFINITIONS.filter((definition) =>
    definition.generation in discs &&
    (args.generation == null || definition.generation === args.generation)
  );
  const elves = await readElves(
    definitions.map((definition) => definition.generation),
  );
  const lines = [];
  for (const definition of definitions) {
    const elf = elves.get(definition.generation) as Uint8Array;
    lines.push(await linesOf(definition, elf));
  }
  console.log(OUTPUT_HEADER);
  lines.flat().forEach((line) => console.log(line));
}

if (import.meta.main) {
  await main();
}
