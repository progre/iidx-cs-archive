// 1世代の周回。原盤を1回だけ開き、その世代の読み取りをすべて済ませて閉じる。
// 実行ファイルと譜面はストレージへ書き、songmapと共に結果で返す。後の処理は、原盤を開かずにそれを引く。

import type { PbSong } from "@csa/report-song-list";
import type { ManifestSongDraft, SongmapDoc } from "@csa/core";
import {
  chartStatsReader,
  type LzPlace,
  writeLzStore,
} from "@csa/contents-chart";
import type { DisplayLap } from "../ports/display/mod.ts";
import {
  convertEra1Generation,
  type Era1ConvertPlaces,
  loadEra1Source,
  loadFormats,
  readPlainCharts,
} from "../ports/media/mod.ts";
import type { CopyLap } from "@csa/contents-video";
import type { SoundLap } from "@csa/layout-sound-bundle";
import { type DiscOpener, readRootFile } from "@csa/containers-disc";
import type { SourceElfStore } from "@csa/contents-elf";
import {
  lapRowsOf,
  lapSourceOf,
  songmapOfGeneration,
} from "../ports/song/mod.ts";
import { pbLapOf } from "./pb_lap.ts";
import { type DiscInfo, discInfoOf, type PbSource } from "@csa/containers-disc";
import {
  chartFormatOf,
  elfFileNameOf,
  eraOf,
  PB_GENERATION,
} from "@csa/selection-definitions";
import { selectEra1Jobs } from "@csa/selection-video-era1";
import {
  type LapOutputOptions,
  type LapOutputs,
  writeLapOutputs,
} from "./lap_outputs.ts";
import type { LapSongBytes } from "@csa/contents-song-db";

/** 周回が次へ渡す、世代ごとの結果。PBの周回は、行を持たない */
export interface GenerationLap {
  generation: string;
  /** 原盤のファイル一覧と大きさ */
  info: DiscInfo;
  /** 周回で書いた、LZ済みの譜面の置き場。PBの周回も持つ */
  lz: LzPlace;
  /** 曲の行。収録する行と、全曲リストで外した行には、下書きの値を書いてある */
  rows: ManifestSongDraft[];
  songmap: SongmapDoc;
  /** 開いたままのPBの原盤。PBの周回だけが持つ。この値を受け取った呼び出し側が閉じる */
  pb?: PbSource;
  /** PB原盤の曲。PBの周回だけが持つ */
  pbSongs?: PbSong[];
  /** 周回で書いた曲名カードとオーバーレイの`.if`。PBの周回は持たない */
  display?: DisplayLap;
  /** 周回で書いた音のbundle。PBの周回は持たない */
  sound?: SoundLap;
  /** 素材側の識別子 → 音とオーバーレイの長さ。長さは末尾のゼロを除いて数える。PBの周回は、オーバーレイの長さだけを持つ */
  sourceLengths?: LapOutputs["sourceLengths"];
  /** 素材側の識別子 → 音の本体とヘッダーのハッシュ。PBの周回は持たない */
  soundPrints?: LapOutputs["soundPrints"];
  /** `overlaySourceOf`の識別子 → オーバーレイの中身のハッシュ。PBの周回も持つ */
  contentPrints?: LapOutputs["contentPrints"];
  /** 再符号化しない映像。その世代の周回の中で原盤から読み、ファイルに書く。PBの周回の結果には無い */
  copy?: CopyLap;
  /** 曲番号から全曲リストの行を引く表。PBの周回は持たない */
  catalogRows?: LapOutputs["catalogRows"];
}

/** 周回の中で書き出す先 */
export interface LapOptions extends LapOutputOptions {
  era1: Era1ConvertOptions;
  /** 読む素材世代。PBは含めず、必ず読む */
  generations: readonly string[];
  openDisc: DiscOpener;
}

/** era1のムービーの変換の置き場と動かし方。変換したムービーの置き場は、`discsDirectory`から決まる */
export type Era1ConvertOptions = Omit<Era1ConvertPlaces, "discsDirectory">;

/** `elves`には、前の周回で読んだ世代の実行ファイルも入っている */
export async function lapGeneration(
  generation: string,
  { era1, generations: _, openDisc, ...directories }: LapOptions,
  bytes: LapSongBytes,
  elves: SourceElfStore,
): Promise<GenerationLap> {
  const opened = await openDisc(generation);
  using closing = new DisposableStack();
  closing.defer(() => opened.disc.close());
  const elf = await readRootFile(opened.disc, elfFileNameOf(generation));
  elves.save(generation, elf);
  const songmap = songmapOfGeneration(generation, elf);
  bytes.record(generation, elf, songmap);
  const info = discInfoOf(opened);
  console.time(`time ${generation} charts`);
  const charts = await readPlainCharts(
    generation,
    elf,
    songmap.files,
    opened,
  );
  // PBの譜面も書く。曲リストは、周回を終えた後でPBの譜面を読み、中身を比べる
  const lz = writeLzStore(directories.discsDirectory, generation, charts);
  console.timeEnd(`time ${generation} charts`);
  if (generation === PB_GENERATION) {
    const lap = await pbLapOf(
      opened,
      { elf, songmap },
      info,
    );
    // PBの原盤は、ISOの書き込みと検証の終わりまで開いておく
    closing.move();
    return { ...lap, lz };
  }
  const era = eraOf(generation);
  const era1Jobs = era === "era1"
    ? await selectEra1Jobs({
      formatsOf: async (source) => {
        console.time(`time ${generation} era1 movie formats`);
        const formats = await loadFormats(generation, source, opened);
        console.timeEnd(`time ${generation} era1 movie formats`);
        return formats;
      },
      sourceOf: () => loadEra1Source(generation, elf),
    }, generation)
    : [];
  if (era1Jobs.length > 0) {
    console.time(`time ${generation} era1 movie conversion`);
    await convertEra1Generation(era1Jobs, opened, {
      ...era1,
      discsDirectory: directories.discsDirectory,
    });
    console.timeEnd(`time ${generation} era1 movie conversion`);
  }
  const { catalogRows, rows } = await lapRowsOf(
    generation,
    era,
    { elf, songmap },
    opened,
    era1Jobs,
  );
  const statsOf = chartStatsReader(
    generation,
    charts,
    chartFormatOf(generation),
  );
  const outputs = await writeLapOutputs(
    opened,
    lapSourceOf(generation, { elf, songmap, statsOf }),
    rows,
    catalogRows,
    directories,
    (other) => elves.elfOf(other),
  );
  return { generation, info, lz, songmap, ...outputs };
}
