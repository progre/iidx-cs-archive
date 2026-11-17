// era1の採用ムービーを全てPB用PSSへ変換する。
// 1本ごとに、周回で開いたISOから切り出したムービーをffmpegで再エンコードし、自前の多重化器でPSSにする。
// ISOからの読み出しは1本ずつ順に行い、ffmpegだけを並列に動かす。
// 出力は<discs dir>/<作品>/video_converted/<ファイル>.pssで、検査結果と採用曲を同名の.jsonに書く。
// 変換には時間がかかるので、既定では変換済みの本を飛ばす。`--full`を付けると、すべて変換し直す。
//
// era1の世代の周回が、`convertEra1Generation`を呼ぶ。

import { pooledMap } from "@std/async/pool";
import { runFfmpeg } from "../ffmpeg_gateway.ts";
import { muxAndInspect } from "../head/mod.ts";
import {
  fileExists,
  isConverted,
  makeDirectory,
  readReportText,
  readTempFile,
  removeEmptyDirectory,
  removeTempFile,
  writeConverted,
  writeTempFile,
} from "./convert_gateway.ts";
import type { Era1ConvertPorts, Era1VideoRange } from "./ports.ts";

/** 渡した処理を、前に渡した処理が終わってから1つずつ動かす */
function inSequence(): <T>(task: () => Promise<T>) => Promise<T> {
  let last: Promise<unknown> = Promise.resolve();
  return (task) => {
    const result = last.then(task);
    last = result.catch(() => {});
    return result;
  };
}

/**
 * era1ムービーの変換の置き場と動かし方。
 * - `discsDirectory`: 周回の成果物を世代ごとに置く場所。変換したムービーは、その下の`<世代>/video_converted/`へ書く
 * - `reconvert`: 真なら、変換済みのムービーも変換し直す
 * - `tmpDir`: ISOから読み出した変換前のムービーを置くフォルダー。変換が終わった時点で空なら、フォルダーを消す
 */
export interface Era1ConvertPlaces {
  discsDirectory: string;
  parallel: number;
  reconvert: boolean;
  tmpDir: string;
}

/** 報告の行と、変換結果を確かめる処理。確かめるのは、世代の変換がすべて終わってからである */
interface Converted {
  check: () => void;
  line: string;
}

async function convert<J extends { video: Era1VideoRange }>(
  job: J,
  readOne: (job: J) => Promise<Uint8Array>,
  ports: Era1ConvertPorts<J>,
  { discsDirectory, reconvert, tmpDir }: Era1ConvertPlaces,
): Promise<Converted> {
  const { video } = job;
  const output = ports.outputPathOf(discsDirectory, job);
  if (!reconvert && isConverted(output)) {
    return {
      check: () => {
        if (!fileExists(output)) {
          throw new Error(
            `${ports.labelOf(job)} 変換済みムービーが無い: ${output}`,
          );
        }
        ports.checkReport(job, readReportText(output));
      },
      line: `${ports.labelOf(job)}: done`,
    };
  }
  const sourcePath = `${tmpDir}/${video.generation}_${video.key}.pss`;
  const esPath = `${tmpDir}/${video.generation}_${video.key}.m2v`;
  const source = await readOne(job);
  writeTempFile(sourcePath, source);
  await runFfmpeg([
    "-i",
    sourcePath,
    "-an",
    "-vf",
    ports.filterOf(job),
    ...ports.encodeArgs,
    esPath,
  ]);
  const { pictures, problems, pss } = muxAndInspect(
    readTempFile(esPath),
    source,
    ports.findProblems,
  );
  const result = { pictures, problems, size: pss.length };
  const metaText = ports.metaTextOf(job, result);
  writeConverted(output, pss, metaText);
  removeTempFile(sourcePath);
  removeTempFile(esPath);
  return {
    check: () => ports.checkReport(job, metaText),
    line: ports.reportLineOf(job, result),
  };
}

/**
 * 1世代のムービーを変換する。`jobs`はその世代のもの。
 * 原盤からの読み出し(`ports.read`)は、1本ずつ順に行う。
 */
export async function convertEra1Generation<
  J extends { video: Era1VideoRange },
>(
  jobs: readonly J[],
  ports: Era1ConvertPorts<J>,
  places: Era1ConvertPlaces,
): Promise<void> {
  makeDirectory(places.tmpDir);
  console.log(`converting ${jobs.length} movies (parallel ${places.parallel})`);
  const sequentially = inSequence();
  const readOne = (job: J) => sequentially(() => ports.read(job));
  let done = 0;
  const converted: Converted[] = [];
  const results = pooledMap(
    places.parallel,
    jobs,
    (job) => convert(job, readOne, ports, places),
  );
  for await (const result of results) {
    converted.push(result);
    console.log(`${++done}/${jobs.length} ${result.line}`);
  }
  removeEmptyDirectory(places.tmpDir);
  converted.forEach(({ check }) => check());
}
