// 曲DBの1曲が使う譜面とキー音・BGMを、ファイルの一覧に書き込む。

import {
  type Context,
  labelsOf,
  namesOf,
  NO_FILE_16,
  NO_FILE_32,
  shiftOf,
  type SongMeta,
} from "./context.ts";
import type { SongmapRecord } from "../types.ts";

const ELF_ADDRESS_MASK = 0x0fffffff;

/** 譜面のファイル番号から、通し番号を得る */
function chartSerialOf(value: number, { entries, rule }: Context): number {
  if (rule.chartArchive == null) {
    return value;
  }
  return (value & ELF_ADDRESS_MASK) + entries.baseOf(rule.chartArchive);
}

const hasChart = (value: number) => value !== NO_FILE_32 && value !== 0;

export function readCharts(
  record: SongmapRecord,
  meta: SongMeta,
  ctx: Context,
) {
  const { def, elfLength, entries } = ctx;
  const labels = labelsOf(ctx);
  record.chart.files.forEach((value, index) => {
    if (!hasChart(value)) {
      return;
    }
    const label = labels[index];
    const name = `${meta.title} [${label}].ply`;
    namesOf(meta, label).chart = name;
    const reference = { songId: meta.songId, name };
    if (def.songDbRecordLayout.chart.areElfPointers) {
      const offset = value - def.pointerBase;
      const size = elfLength - value - def.pointerBase;
      entries.append({
        archive: def.fileName,
        offset,
        size,
        refs: [reference],
      });
      return;
    }
    entries.refer(chartSerialOf(value, ctx), reference);
  });
}

/** キー音とBGMの組。組の並びは、SPとDPが交互になる */
function soundPairsOf(sounds: readonly number[]): number[][] {
  return Array.from({ length: sounds.length / 2 }, (_, p) => {
    const group = Math.floor(p / 2) * 4 + (p % 2);
    return [sounds[group], sounds[group + 2]];
  });
}

/** ANOTHER専用のBGMが正の値なら、原作のローダーはANOTHERでこの値を鳴らす */
function withAnotherBgm(
  pairs: number[][],
  anotherBgm: number | null,
  labels: readonly string[],
): number[][] {
  if (anotherBgm == null || anotherBgm === NO_FILE_16 || anotherBgm === 0) {
    return pairs;
  }
  const pairIndex = labels.indexOf("SP ANOTHER");
  const filled = Array.from(
    { length: Math.max(pairs.length, pairIndex + 1) },
    (_, index) => pairs[index] ?? [NO_FILE_16, NO_FILE_16],
  );
  filled[pairIndex] = [filled[pairIndex][0], anotherBgm];
  return filled;
}

/** キー音とBGMの組。原作のローダーと同じく、値のあるフィールドの難易度として読む */
function readPairedSounds(
  record: SongmapRecord,
  meta: SongMeta,
  ctx: Context,
) {
  const { def, entries } = ctx;
  const labels = labelsOf(ctx);
  const archiveRule = def.songDbRecordLayout.video.archiveRule;
  const origin = record.selection.origin;
  const pairs = withAnotherBgm(
    soundPairsOf(record.chart.sounds),
    record.chart.anotherBgm,
    labels,
  );
  pairs.forEach((pair, pairIndex) => {
    pair.forEach((value, kind) => {
      if (value === NO_FILE_16) {
        return;
      }
      const serial = shiftOf(archiveRule, value, origin, ctx);
      const extension = kind === 0 ? "wvb" : "pcm";
      const name = `${meta.title} [${pairIndex}].${extension}`;
      entries.refer(serial, { songId: meta.songId, name });
      const names = namesOf(meta, labels[pairIndex]);
      if (kind === 0) {
        names.sounds = name;
      } else {
        names.bgm = name;
      }
    });
  });
}

/** 譜面のある枠すべてに、その枠の組を書く。組が空なら先頭の組を使い、組の番号は付け替えない */
function readSoundsPerChart(
  record: SongmapRecord,
  meta: SongMeta,
  ctx: Context,
) {
  const labels = labelsOf(ctx);
  const pairs = soundPairsOf(record.chart.sounds);
  const fallback = pairs[0];
  record.chart.files.forEach((value, index) => {
    if (!hasChart(value)) {
      return;
    }
    (["sounds", "bgm"] as const).forEach((field, position) => {
      const own = pairs[index][position];
      const file = own === NO_FILE_16 ? fallback[position] : own;
      if (file === NO_FILE_16) {
        return;
      }
      const extension = field === "sounds" ? "wvb" : "pcm";
      const name = `${meta.title} [${index}].${extension}`;
      ctx.entries.refer(file, { songId: meta.songId, name });
      namesOf(meta, labels[index])[field] = name;
    });
  });
}

export function readSounds(
  record: SongmapRecord,
  meta: SongMeta,
  ctx: Context,
) {
  if (ctx.rule.soundPlan === "perChart") {
    return readSoundsPerChart(record, meta, ctx);
  }
  return readPairedSounds(record, meta, ctx);
}
