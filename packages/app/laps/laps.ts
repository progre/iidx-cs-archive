// 周回の順に、原盤を1枚ずつ読む。

import type { PbSong } from "@csa/report-song-list";
import type { ManifestSongDraft, SongmapDoc, SoundPrint } from "@csa/core";
import {
  type LapPbBack,
  type LapSources as Sources,
  lapSourcesOf,
  withOtherGenerationRows,
} from "@csa/selection-manifest";
import {
  elfDefinitionOf,
  indexGenerationsOf,
  lapOrderOf,
} from "@csa/selection-definitions";
import type { DisplayLap } from "../ports/display/mod.ts";
import {
  catalogFiveKeys,
  catalogRowsOf,
  catalogVariants,
} from "../ports/song/mod.ts";
import type { SoundLap } from "@csa/layout-sound-bundle";
import type { CopyLap } from "@csa/contents-video";
import type { CatalogRow } from "@csa/selection-song-catalog";
import type { LzPlace } from "@csa/contents-chart";
import { fileSourceElfPorts, SourceElfStore } from "@csa/contents-elf";
import type { DiscInfo, PbSource } from "@csa/containers-disc";
import { settleFronts } from "./fronts.ts";
import { lapGeneration, type LapOptions } from "./generation_lap.ts";
import { LapSongBytes } from "@csa/contents-song-db";

export type LapSources = Sources<Uint8Array, LzPlace>;

/** 周回の後にmanifestを仕上げるのに使う値。周回の後は、ここからELFを読まずに引く */
export interface LapSongs {
  /** 世代 → 全曲リストを曲番号から引く表 */
  catalogRows: Map<string, Map<number, CatalogRow>>;
  bytes: LapSongBytes;
  /** 表を PB 以外の版にした組の、PB 原盤の曲の写しの裏 */
  pbBacks: LapPbBack[];
  /** 周回で読んだ素材。ELFは、ここから引くたびにファイルから読む */
  sources: LapSources;
}

export interface LapResult {
  /** 世代 → 曲の行。PBの行は無い */
  rowsOf: Map<string, ManifestSongDraft[]>;
  /** 世代 → 原盤のファイル一覧と大きさ */
  discs: Map<string, DiscInfo>;
  /** 開いたままのPBの原盤。この値を受け取った呼び出し側が、ISOの書き込みと検証の後に閉じる */
  pb: PbSource;
  /** PB原盤の曲。曲リストに載せる */
  pbSongs: PbSong[];
  /** 世代 → 周回で書いた曲名カードとオーバーレイの`.if` */
  displayLaps: Map<string, DisplayLap>;
  /** 世代 → 周回で書いた音のbundle */
  soundLaps: Map<string, SoundLap>;
  /** 素材側の識別子 → 音とオーバーレイの、末尾のゼロを除いた長さ。PBの分は、オーバーレイの長さだけを持つ */
  sourceLengths: Map<string, number>;
  /** 素材側の識別子 → 世代の音の本体とヘッダーのハッシュ。PBの分は持たない */
  soundPrints: Map<string, SoundPrint>;
  /** `overlaySourceOf`の識別子 → オーバーレイの中身のハッシュ。PBの分も持つ */
  contentPrints: Map<string, string>;
  /** 世代 → 再符号化しない映像。周回で原盤から読んで、ファイルに書く */
  copyLaps: Map<string, CopyLap>;
  /** 周回で作った曲の下書きと、manifestを仕上げるのに使う値 */
  songs: LapSongs;
}

/**
 * 周回の中で、era1のムービーの変換と、音のbundleと`.if`の書き出しまで済ませる。
 * どの世代も、周回の中で原盤を開くのは1回だけである。
 * PBの原盤だけは閉じずに返す。
 */
export async function runLaps(
  options: LapOptions,
  runStage: <T>(generation: string, run: () => Promise<T>) => Promise<T>,
): Promise<LapResult> {
  const elves = new SourceElfStore(fileSourceElfPorts(options.discsDirectory));
  const songmaps = new Map<string, SongmapDoc>();
  const lzPlaces = new Map<string, LzPlace>();
  const discs = new Map<string, DiscInfo>();
  const displayLaps = new Map<string, DisplayLap>();
  const soundLaps = new Map<string, SoundLap>();
  const sourceLengths = new Map<string, number>();
  const soundPrints = new Map<string, SoundPrint>();
  const contentPrints = new Map<string, string>();
  const copyLaps = new Map<string, CopyLap>();
  const rowsOf = new Map<string, ManifestSongDraft[]>();
  const bytes = new LapSongBytes(elfDefinitionOf);
  const catalogRows: LapSongs["catalogRows"] = new Map();
  const pbSongs: PbSong[] = [];
  let pb: PbSource | undefined;
  let variantRowsOf: Map<string, ManifestSongDraft[]>;
  let songs: LapSongs;
  try {
    for (const generation of lapOrderOf(options.generations)) {
      console.time(`time ${generation} lap`);
      const lap = await runStage(
        generation,
        () => lapGeneration(generation, options, bytes, elves),
      );
      console.timeEnd(`time ${generation} lap`);
      pb = lap.pb ?? pb;
      pbSongs.push(...lap.pbSongs ?? []);
      songmaps.set(generation, lap.songmap);
      lzPlaces.set(generation, lap.lz);
      discs.set(generation, lap.info);
      if (lap.display !== undefined) {
        displayLaps.set(generation, lap.display);
      }
      if (lap.sound !== undefined) {
        soundLaps.set(generation, lap.sound);
      }
      lap.sourceLengths?.forEach((length, source) =>
        sourceLengths.set(source, length)
      );
      lap.soundPrints?.forEach((print, source) =>
        soundPrints.set(source, print)
      );
      lap.contentPrints?.forEach((print, source) =>
        contentPrints.set(source, print)
      );
      if (lap.copy !== undefined) {
        copyLaps.set(generation, lap.copy);
      }
      if (lap.rows.length > 0) {
        rowsOf.set(generation, lap.rows);
      }
      if (lap.catalogRows !== undefined) {
        catalogRows.set(generation, lap.catalogRows);
      }
    }
    if (pb === undefined) {
      throw new Error("PBの周回が原盤を返していない");
    }
    settleFronts(
      rowsOf,
      catalogRows,
      pbSongs,
      (generation) => elves.elfOf(generation),
    );
    const finished = withOtherGenerationRows(
      rowsOf,
      catalogRows,
      catalogVariants(),
      catalogFiveKeys(),
    );
    variantRowsOf = finished.rowsOf;
    songs = {
      bytes,
      catalogRows,
      pbBacks: finished.pbBacks,
      sources: lapSourcesOf(
        {
          catalogRowsOf,
          elfOf: (generation) => elves.elfOf(generation),
          indexGenerations: indexGenerationsOf(options.generations),
        },
        songmaps,
        lzPlaces,
      ),
    };
  } catch (error) {
    pb?.[Symbol.dispose]();
    throw error;
  }
  return {
    contentPrints,
    copyLaps,
    discs,
    displayLaps,
    pb,
    pbSongs,
    rowsOf: variantRowsOf,
    songs,
    soundLaps,
    soundPrints,
    sourceLengths,
  };
}
