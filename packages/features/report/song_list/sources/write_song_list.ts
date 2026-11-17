// 曲・譜面の一覧のHTMLとJSONを書く。ISOを作る実行と、曲リストだけを作る実行(`--song-list-only`)の両方が呼ぶ。

import type { PbDisc, PbSong } from "./lap/mod.ts";
import type {
  CatalogRow,
  ExcludedSong,
  FinishedManifest,
  SongmapDoc,
  SoundPrint,
} from "@csa/core";
import type { RowPorts, SongListWritePorts } from "../ports.ts";
import {
  contentLengthsOf,
  type MoviePrints,
  readMoviePrints,
  withPbSoundPrints,
  writeMoviePrints,
} from "./contents/mod.ts";
import {
  type GroupedCatalogs,
  type PbIndex,
  songListInputOf,
} from "./listed/mod.ts";
import { writeSongList } from "./song_list_gateway.ts";
import { difficultiesOf, type SongListInput } from "../data/mod.ts";
import { pageHtml } from "../view/mod.ts";
import type { SongListData } from "../types.ts";
import { songRowsOf } from "../data/rows/mod.ts";

// 曲リストのHTMLと、その元データのJSONを組む。データは`data/`が組み、HTMLは`view/`が組む。
// 曲リストHTMLへ渡すデータ(全曲・全譜面の一覧)を組む。
export const songListData = (
  ports: RowPorts,
  input: SongListInput,
): SongListData => ({
  contentPrints: input.contentPrints,
  difficulties: difficultiesOf(ports.chartSlots),
  label: input.label,
  movieAliases: input.movieAliases,
  songs: songRowsOf(ports, input),
  soundPrints: input.soundPrints,
});

/** JSONではMapを表せないので、オブジェクトにする */
const mapsAsObjects = (_key: string, value: unknown) =>
  value instanceof Map ? Object.fromEntries(value) : value;

export function songListFiles(
  ports: RowPorts,
  input: SongListInput,
): { html: string; json: string } {
  const data = songListData(ports, input);
  return {
    html: pageHtml(data),
    json: JSON.stringify(data, mapsAsObjects, 2),
  };
}

/** 実行のうち、曲リストに使う部分 */
export interface SongListRun {
  full: boolean;
  removed: readonly ExcludedSong[];
  sourceManifest: FinishedManifest;
}

/** 周回の結果のうち、曲リストに使う部分 */
export interface SongListLaps<S> {
  contentPrints: ReadonlyMap<string, string>;
  pb: PbDisc;
  pbSongs: readonly PbSong[];
  songs: {
    catalogRows: ReadonlyMap<string, ReadonlyMap<number, CatalogRow>>;
    sources: S & {
      index: PbIndex;
      songmapOf: (generation: string) => SongmapDoc;
    };
  };
  soundPrints: ReadonlyMap<string, SoundPrint>;
  sourceLengths: ReadonlyMap<string, number>;
}

export interface SongListOptions<P> {
  catalogs: GroupedCatalogs;
  /** ISOの中身を表す名前 */
  label: string;
  /** 素材を整える。曲リストは、整えた後のmanifestを載せる */
  prepare: () => P;
  /** 書き出し先 */
  report: { data: string; html: string };
}

/** 曲リストを書き、素材を整えた結果を返す。ISOを作る実行は、この結果から配置計画を作る */
export async function writeSongListFiles<
  S,
  P extends { manifest: FinishedManifest },
>(
  ports: SongListWritePorts<S>,
  { full, removed, sourceManifest }: SongListRun,
  laps: SongListLaps<S>,
  { catalogs, label, prepare, report }: SongListOptions<P>,
): Promise<P> {
  const { sources } = laps.songs;
  const pbSongmap = sources.songmapOf("pb");
  // 長さは、prepareAssetsを呼ぶ前のmanifestで数える
  console.time("time song list lengths");
  // `--full`では記録を読まず、すべてのムービーの長さとハッシュを求め直す
  const moviePrints: MoviePrints = full ? new Map() : readMoviePrints();
  const savedCount = moviePrints.size;
  const contents = await contentLengthsOf(
    ports,
    sourceManifest,
    removed,
    laps.sourceLengths,
    pbSongmap,
    laps.pb,
    sourceManifest.sharedVideoAbcIndex ?? ports.fallbackVideoAbcIndex,
    moviePrints,
  );
  writeMoviePrints(moviePrints);
  console.timeEnd("time song list lengths");
  console.log(
    `movie hashes: saved ${savedCount} / computed ${
      moviePrints.size - savedCount
    }`,
  );
  console.time("time PB sound hashes");
  const soundPrints = await withPbSoundPrints(
    ports,
    laps.soundPrints,
    pbSongmap,
    laps.pb,
  );
  console.timeEnd("time PB sound hashes");
  console.time("time asset preparation");
  const prepared = prepare();
  console.timeEnd("time asset preparation");
  console.time("time song list export");
  writeSongList(
    () =>
      songListInputOf(ports, {
        catalogs,
        excluded: removed,
        chartPrintsOf: ports.chartPrintsReader(sources),
        chartShapesOf: ports.chartShapesReader(sources),
        index: sources.index,
        label,
        catalogRows: laps.songs.catalogRows,
        contentPrints: new Map([...laps.contentPrints, ...contents.prints]),
        lengths: contents.lengths,
        manifest: prepared.manifest,
        movieAliases: ports.movieAliases(),
        pbSongs: laps.pbSongs,
        soundPrints,
      }),
    (input) => songListFiles(ports, input),
    report,
  );
  console.timeEnd("time song list export");
  return prepared;
}
