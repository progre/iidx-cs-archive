// era1ムービーをPB用PSSへ変換する時の諸元と、変換結果の検査。

import type { Crop, Era1Job } from "./types.ts";
import { sourceKeyOf } from "./adoption/mod.ts";

// 変換結果の`.json`が、ビルドを続けてよい状態かを確かめる。I/Oは行わない。
/**
 * 変換結果に問題が記録されているか、元のファイルが`job`と違えば例外にする。
 * 前のビルドの結果を使い回すときも、変換し直した結果も、同じ確認を通す。
 */
export function checkConvertedReport(job: Era1Job, reportText: string): void {
  const report: {
    problems: string[];
    source: { archive: string; offset: number };
  } = JSON.parse(reportText);
  if (report.problems.length > 0) {
    throw new Error(
      `${labelOf(job)} 変換済みムービーに問題: ${report.problems.join(", ")}`,
    );
  }
  const { archive, offset } = report.source;
  const { video } = job;
  if (
    sourceKeyOf(archive, offset) !== sourceKeyOf(video.archive, video.offset)
  ) {
    throw new Error(`${labelOf(job)} 変換済みムービーの元ファイルが違う`);
  }
}

const PACK_SIZE = 16384;

/** PB原盤と同じ諸元。bufsizeはsystem headerのP-STDバッファ1286KiBの内側 */
export const ENCODE_ARGS = [
  "-c:v",
  "mpeg2video",
  "-pix_fmt",
  "yuv420p",
  "-r",
  "30",
  "-g",
  "18",
  "-bf",
  "2",
  "-profile:v",
  "4",
  "-level:v",
  "8",
  "-qmin",
  "1",
  "-qmax",
  "3",
  "-b:v",
  "4000k",
  "-maxrate",
  "4000k",
  "-bufsize",
  "1835008",
  "-f",
  "mpeg2video",
];

/** 帯を切って240x240へ引き伸ばし、画素比を1:1に固定するffmpegのフィルター */
export const cropFilter = ({ h, w, x, y }: Crop): string =>
  `crop=${w}:${h}:${x}:${y},scale=240:240:flags=lanczos,setsar=1`;

/** 変換結果のPSSの構造。検査に使う値だけを持つ */
export interface PssFacts {
  height: number;
  packSizes: number[];
  pictures: number;
  sourcePictures: number;
  systemHeaders: number;
  trailing: number;
  width: number;
}

export function findProblems(facts: PssFacts): string[] {
  const problems: string[] = [];
  if (facts.pictures !== facts.sourcePictures) {
    problems.push(
      `pictures ${facts.pictures} != source ${facts.sourcePictures}`,
    );
  }
  if (facts.packSizes.some((size) => size !== PACK_SIZE)) {
    problems.push("pack length is not 16KB");
  }
  if (facts.trailing !== 0 || facts.systemHeaders !== 1) {
    problems.push("invalid end code or system header");
  }
  if (facts.width !== 240 || facts.height !== 240) {
    problems.push(`resolution ${facts.width}x${facts.height}`);
  }
  return problems;
}

/** `discsDirectory`は、周回の成果物を世代ごとに置く場所 */
export const outputPathOf = (discsDirectory: string, job: Era1Job): string =>
  `${discsDirectory}/${job.video.generation}/video_converted/${job.video.key}.pss`;

export const labelOf = ({ video }: Era1Job): string =>
  `${video.generation} ${video.key} ${video.title}`;

/** 出力PSSの隣に書く、検査結果と採用曲のJSON文字列 */
export function metaTextOf(
  job: Era1Job,
  result: { pictures: number; problems: string[]; size: number },
): string {
  const { video } = job;
  return JSON.stringify({
    band: job.band,
    crop: job.crop,
    pictures: result.pictures,
    problems: result.problems,
    size: result.size,
    songIds: job.songIds,
    source: {
      archive: video.archive,
      index: video.index,
      offset: video.offset,
      size: video.size,
    },
    title: video.title,
  }) + "\n";
}

export function reportLineOf(
  job: Era1Job,
  result: { pictures: number; problems: string[]; size: number },
): string {
  const problems = result.problems.length
    ? " problems: " + result.problems.join(", ")
    : "";
  return `${
    labelOf(job)
  }: ${result.pictures} pictures ${result.size}B${problems}`;
}
