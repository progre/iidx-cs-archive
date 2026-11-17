// 原盤から実行ファイル・songmap・平文の譜面をメモリー上に作る。
// utils は app を参照できないので、features の関数を組み合わせてここに書く。

import type { SongmapDoc } from "@csa/core";
import {
  type Disc,
  openGenerationIso,
  readDiscFolders,
  readRootFile,
  readSegment,
} from "@csa/containers-disc";
import {
  chartKeyFrom,
  plainChartOf,
  type PlainCharts,
  readKeyParts,
} from "@csa/contents-chart";
import { elfSegmentOf, songmapOf } from "@csa/contents-file-table";
import { SongDb } from "@csa/contents-song-db";
import {
  chartFileIndices,
  chartKeyRuleOf,
  DEFINITIONS,
  elfFileNameOf,
  songmapRuleOf,
} from "@csa/selection-definitions";

/** 世代 → 実行ファイルのバイト列 */
export async function readElves(
  generations: Iterable<string>,
): Promise<Map<string, Uint8Array>> {
  const elves = new Map<string, Uint8Array>();
  for (const generation of generations) {
    using iso = await openGenerationIso(readDiscFolders(), generation);
    elves.set(generation, await readRootFile(iso, elfFileNameOf(generation)));
  }
  return elves;
}

const built = new WeakMap<Uint8Array, SongmapDoc>();

export function songmapOfGeneration(
  generation: string,
  elf: Uint8Array,
): SongmapDoc {
  const cached = built.get(elf);
  if (cached != null) {
    return cached;
  }
  const def = DEFINITIONS.find((each) => each.generation === generation);
  if (def == null) {
    throw new Error("曲DBの定義が無い世代: " + generation);
  }
  const rule = songmapRuleOf(generation);
  const db = new SongDb(elf, def.elf);
  const records = Array.from(
    { length: rule.songCount ?? db.length },
    (_, index) => db.record(index),
  );
  const doc = songmapOf({ elf, def: def.elf, rule, records });
  built.set(elf, doc);
  return doc;
}

/** 譜面を原盤から読み、復号とLZ展開をする。3rd〜6thの譜面は実行ファイルの中にある */
export async function readPlainCharts(
  generation: string,
  elf: Uint8Array,
): Promise<PlainCharts> {
  const { files } = songmapOfGeneration(generation, elf);
  const elfName = elfFileNameOf(generation).toUpperCase();
  const rule = chartKeyRuleOf(generation);
  const key = rule === null
    ? null
    : chartKeyFrom(elf, readKeyParts(elf, rule.offsets), rule.picks);
  const iso = await openGenerationIso(readDiscFolders(), generation);
  try {
    const disc: Disc = { disc: iso, files: await iso.collectFiles() };
    const charts = new Map<number, Uint8Array>();
    for (const index of chartFileIndices(files)) {
      const file = files[index];
      const raw = file.archive.toUpperCase() === elfName
        ? elfSegmentOf(elf, file)
        : await readSegment(disc, file);
      charts.set(index, plainChartOf(raw, key));
    }
    return charts;
  } finally {
    iso.close();
  }
}
