// 曲リストのデータを組む入力を、CSA の曲の記録と、周回で読んだPB原盤の曲から作る。
// 曲DBエントリは、PB形式の定義(`PB_ENTRY`)で解読して曲リストの値にする。原盤は読まない。

import type { PbSong } from "../lap/mod.ts";
import type {
  CatalogRow,
  ExcludedSong,
  FinishedManifest,
  PbVersions,
  SoundPrint,
} from "@csa/core";
import type {
  ChartPrintsOf,
  ChartShapesOf,
  SongListWritePorts,
} from "../../ports.ts";
import {
  chartGroupsOf,
  type ChartOwner,
  unlinkedSameOf,
  withGroups,
} from "../charts/mod.ts";
import {
  editionsOf,
  type GroupedCatalogs,
  subtitlesOf,
} from "./catalog_fields.ts";
import { listedSongOf } from "./listed.ts";
import {
  listedPbSongsOf,
  type PbIndex,
  pbKeyOf,
  pbKeysOf,
} from "./pb_listed.ts";

type Ports = Pick<
  SongListWritePorts<unknown>,
  | "applyFiveKeyFields"
  | "catalogKeyOf"
  | "decodeEntry"
  | "difficultyNameOfChartField"
  | "generations"
  | "listEntryOf"
  | "pbListEntryOf"
  | "pbVersionsOf"
  | "versionFolder"
  | "withPbVersion"
>;

export interface SongListSources {
  /** 世代 → 曲番号 → 全曲リストの行 */
  catalogRows: ReadonlyMap<string, ReadonlyMap<number, CatalogRow>>;
  catalogs: GroupedCatalogs;
  chartPrintsOf: ChartPrintsOf;
  chartShapesOf: ChartShapesOf;
  /** 素材側の識別子 → ムービーとオーバーレイの中身のハッシュ */
  contentPrints: ReadonlyMap<string, string>;
  excluded: readonly ExcludedSong[];
  index: PbIndex;
  label: string;
  lengths: ReadonlyMap<string, number>;
  manifest: FinishedManifest;
  /** ムービーの`世代:番号` → 別名 */
  movieAliases: ReadonlyMap<string, string>;
  pbSongs: readonly PbSong[];
  /** 音の素材側の識別子 → 本体とヘッダーのハッシュ */
  soundPrints: ReadonlyMap<string, SoundPrint>;
}

/** 曲リストに載る全部の曲。収録する曲、外した曲、PB原盤の曲である */
function ownersOf(
  { excluded, index, manifest, pbSongs }: SongListSources,
): ChartOwner[] {
  const pbKeys = pbKeysOf(index);
  return [
    ...manifest.songs.map((song) => ({
      excludedCharts: song.excludedCharts,
      generation: song.sourceGeneration,
      key: song.canonicalKey,
      moves: {
        ...song.variantOf?.frontCharts,
        ...song.variantOf?.movedCharts,
      },
      songId: song.sourceSongIndex,
    })),
    ...excluded.map((song) => ({
      generation: song.sourceGeneration,
      key: song.canonicalKey,
      removed: true as const,
      songId: song.sourceSongIndex,
    })),
    ...pbSongs.map(({ song }) => ({
      generation: "pb",
      key: pbKeyOf(pbKeys, song.song_id),
      songId: song.song_id,
    })),
  ];
}

/** 5鍵盤版の表がPB原盤の曲なら、作品番号を直した後のPBのエントリーから値を写す */
function listedSongsOf(
  ports: Ports,
  songs: FinishedManifest["songs"],
  pbSongs: readonly PbSong[],
  chartPrintsOf: ChartPrintsOf,
  folders: PbVersions,
) {
  const pbEntries = new Map(
    pbSongs.map(({ entry, song }) => [
      song.song_id,
      ports.withPbVersion(entry, song.song_id, folders),
    ]),
  );
  return songs.map((song) =>
    listedSongOf(ports, { pbEntries, songs }, song, chartPrintsOf)
  );
}

/**
 * 譜面のハッシュに、同じ譜面を持つ版の集まりを書き足す。集まりは、同じ曲の版どうしを比べて決める。
 * 難易度をまたいで同じなのに移して結んでいない譜面は、ログに出す
 */
export function songListInputOf(ports: Ports, sources: SongListSources) {
  const owners = ownersOf(sources);
  const groups = chartGroupsOf(
    owners,
    sources.chartShapesOf,
    ports.generations,
  );
  const unlinked = unlinkedSameOf(owners, groups.samePairs);
  console.log(
    `identical selectable charts across difficulties: ${unlinked.length} pairs`,
  );
  unlinked.forEach((line) => console.log(`  ${line}`));
  return songListInputWith(ports, {
    ...sources,
    chartPrintsOf: withGroups(sources.chartPrintsOf, groups),
  });
}

const songListInputWith = (
  ports: Ports,
  {
    catalogRows,
    catalogs,
    chartPrintsOf,
    contentPrints,
    excluded,
    index,
    label,
    lengths,
    manifest,
    movieAliases,
    pbSongs,
    soundPrints,
  }: SongListSources,
) => ({
  contentPrints,
  excluded: excluded.map((song) => ({
    ...song,
    chartPrints: chartPrintsOf(song.sourceGeneration, song.sourceSongIndex),
    // 外した曲の曲DBエントリにも、収録する曲と同じ規則で作品番号を書いてある
    shown: ports.listEntryOf(ports.decodeEntry(song.entry)),
  })),
  label,
  lengths,
  manifest: {
    ...manifest,
    songs: listedSongsOf(
      ports,
      manifest.songs,
      pbSongs,
      chartPrintsOf,
      ports.pbVersionsOf(manifest),
    ),
  },
  movieAliases,
  pbSongs: listedPbSongsOf(
    ports,
    pbSongs,
    manifest.pbLevels ?? [],
    ports.pbVersionsOf(manifest),
    index,
    chartPrintsOf,
  ),
  soundPrints,
  subtitles: subtitlesOf(ports.catalogKeyOf, catalogRows, catalogs),
  editions: editionsOf(ports.catalogKeyOf, catalogRows, catalogs),
});
