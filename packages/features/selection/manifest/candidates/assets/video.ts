// 動画1本の経路。era1は採用の有無、era2/era3は無変換コピーと原盤の解像度。

import {
  type ConversionPath,
  INTERMEDIATE_DIRECTORY,
  type SongmapSong,
  type SourceAsset,
} from "@csa/core";
import type { AssetContext, Era1VideoJob, SourceFile } from "./types.ts";

// 曲DB以外の資産(譜面・キー音・BGM・era1動画)の経路と置き場の定義。
/** 周回の成果物を、世代ごとにまとめて置く場所。ISOを書き終えるまで消さない */
export const DISCS_DIRECTORY = `${INTERMEDIATE_DIRECTORY}/discs`;

/** era2/era3の動画は解像度に関わらず無変換で置ける */
export const copyVideoPath = (): ConversionPath => "copy";

/** fileはアーカイブ名と表の行で作る名前(`selection/video_era1`の`videoKeyOf`) */
export const era1VideoOutput = (generation: string, file: string): string =>
  `${DISCS_DIRECTORY}/${generation}/video_converted/${file}.pss`;

/** 原盤のアーカイブと位置から era1 のムービーを引くための名前。songmapのファイルとも突き合わせられる */
export const sourceKeyOf = (archive: string, offset: number): string =>
  archive.toUpperCase() + "@" + offset;

function fail(message: string): never {
  throw new Error(message);
}

type VideoRoute = Pick<
  SourceAsset,
  "output" | "path" | "resolution"
>;

function era1JobOf(
  context: AssetContext,
  song: SongmapSong,
  file: SourceFile,
): Era1VideoJob | undefined {
  const job = context.era1Jobs.get(sourceKeyOf(file.archive, file.offset));
  return job?.songIds.includes(song.song_id) ? job : undefined;
}

function era1Video(
  context: AssetContext,
  song: SongmapSong,
  file: SourceFile,
): VideoRoute {
  const job = era1JobOf(context, song, file);
  if (job !== undefined) {
    return {
      output: era1VideoOutput(context.generation, job.video.key),
      path: "reencode",
    };
  }
  return { path: "excluded" };
}

export async function videoRoute(
  context: AssetContext,
  song: SongmapSong,
  file: SourceFile,
): Promise<VideoRoute> {
  if (context.era === "era1") {
    return era1Video(context, song, file);
  }
  return {
    path: copyVideoPath(),
    resolution: await context.readResolution(file),
  };
}

/**
 * 曲のムービーの番号。era2/era3で2本目の中身が1本目と同じなら、2本目を落とす。
 * 同じ中身の2本目は、PBが1本目と同じ映像を流すので、置かなくてよい
 */
export async function distinctVideosOf(
  context: AssetContext,
  song: SongmapSong,
): Promise<number[]> {
  const [first, second] = song.videos;
  if (context.era === "era1" || second === undefined) {
    return song.videos;
  }
  const fileOf = (index: number) =>
    context.files.get(index) ??
      fail(`${context.generation} song${song.song_id} file${index}が無い`);
  return await context.sameBytes(fileOf(first), fileOf(second))
    ? [first]
    : song.videos;
}

/** 採用した era1 ムービーを、作品ごとに`sourceKeyOf`で引ける表にする */
export function groupEra1Jobs(
  jobs: readonly Era1VideoJob[],
): Map<string, Map<string, Era1VideoJob>> {
  const byGeneration = new Map<string, Map<string, Era1VideoJob>>();
  for (const job of jobs) {
    const { archive, generation, offset } = job.video;
    const keyed = byGeneration.get(generation) ??
      new Map<string, Era1VideoJob>();
    keyed.set(sourceKeyOf(archive, offset), job);
    byGeneration.set(generation, keyed);
  }
  return byGeneration;
}
