// 渡された全世代の行から、載せる曲と素材を決めてmanifestを作る。
// 載せるのは`buildableSongs`(ドリルを除く全世代)。
// 同じ曲の別作品版は、別の曲として載せる。
// 動画はPBが再生できる240x240と480x480なら原作のものを個別に置く。
// それ以外はPBの明るいBGAを暫定で参照させる。
// 曲の下書きと曲DBの値は周回で作ったものを使い、ELFは読まない。

import type {
  CatalogRow,
  FinishedManifest,
  ManifestSongDraft,
  ManifestSource,
  PbLevels,
  PbVersion,
} from "@csa/core";
import { pbBacksOf, pbSlotFilter } from "../../candidates/catalog/mod.ts";
import { buildableSongs } from "../../candidates/rows/mod.ts";
import { chartedSongs } from "../charts/mod.ts";
import { manifestReportLines } from "../report.ts";
import {
  assembleManifest,
  manifestOrderOf,
  plannedSongs,
  selectSongs,
  targetSongCountOf,
} from "../rows/mod.ts";
import { withSortTitles } from "../sort_titles/mod.ts";
import { loadFolderRules } from "./folder_rules.ts";
import type { ManifestBuildPorts, ManifestLaps } from "./ports.ts";
import { adoptedVideos } from "./videos.ts";

export interface BuiltManifest<Excluded> {
  detached: ManifestSongDraft[];
  manifest: FinishedManifest;
  /** 全曲リストで外した曲 */
  removed: Excluded[];
  selected: ManifestSongDraft[];
}

function fail(message: string): never {
  throw new Error(message);
}

/** PB原盤の曲は manifest に載らないので、全曲リストで書いた難易度だけを別に持つ */
const pbLevelsOf = <Elf>(
  { levelsByDifficulty }: ManifestBuildPorts<Elf, unknown>,
  rows: ReadonlyMap<number, CatalogRow>,
): PbLevels[] =>
  [...rows]
    .filter(([, row]) => Object.keys(row.levels).length > 0)
    .map(([songIndex, row]) => ({
      levels: Object.fromEntries(levelsByDifficulty(row.levels)),
      songIndex,
    }));

/** 同じく、全曲リストの`folder`で決めた作品番号を別に持つ */
const pbVersionsOf = <Elf>(
  { tables }: ManifestBuildPorts<Elf, unknown>,
  rows: ReadonlyMap<number, CatalogRow>,
): PbVersion[] =>
  [...rows].flatMap(([songIndex, row]) =>
    row.folder === null
      ? []
      : [{ songIndex, version: tables.folderVersion(row.folder) }]
  );

export function buildManifest<Elf, Excluded>(
  ports: ManifestBuildPorts<Elf, Excluded>,
  songs: readonly ManifestSongDraft[],
  lapSongs: ManifestLaps<Elf>,
): BuiltManifest<Excluded> {
  const { generations, pbGeneration } = ports;
  const selection = selectSongs({
    buildable: buildableSongs(songs),
    generations,
    isPlayable: ports.isPlayable,
  });
  const { detached, selected } = selection;
  // 窓の曲数は、原盤が欠けても、すべての原盤のときと同じにする。セーブの記録の並びを保つためである
  const targetSongCount = targetSongCountOf(ports.saveSlots.count);
  const slotOf = (song: ManifestSongDraft) =>
    song.catalogLine === undefined
      ? undefined
      : ports.saveSlots.indexOf(song.sourceGeneration, song.catalogLine);
  const { keepsPbSong, untaken } = pbSlotFilter(lapSongs.pbBacks);

  const sources: Record<string, ManifestSource> = {};
  const registerSource = (generation: string): void => {
    sources[generation] ??= ports.sourceManifestOf(generation);
  };
  new Set(selected.map((song) => song.sourceGeneration)).forEach(
    registerSource,
  );
  const pbSongmap = lapSongs.sources.songmapOf(pbGeneration);
  const folders = loadFolderRules(ports, lapSongs);
  const removed = ports.excludedSongs(songs, lapSongs.catalogRows, folders);
  // 曲indexを振った後に、周回で素材を書いた並びへ戻す
  const planned = manifestOrderOf(
    plannedSongs(selection, targetSongCount, slotOf),
    generations,
  );
  const finished = planned.map((song) =>
    ports.finishManifestSong(
      song,
      lapSongs.catalogRows.get(song.sourceGeneration) ??
        fail(`${song.sourceGeneration}の全曲リストが周回で読まれていない`),
      folders,
      pbSongmap,
    )
  );
  const charted = chartedSongs(
    finished,
    pbBacksOf(lapSongs.pbBacks, finished, targetSongCount),
    pbSongmap.songs,
    {
      chartSlots: ports.chartSlots,
      generations,
      levelOf: ports.levelOf,
      pbGeneration,
    },
  );

  const videos = adoptedVideos(
    ports,
    charted.songs,
    songs,
    pbSongmap,
    lapSongs,
    registerSource,
    keepsPbSong,
  );
  const pbRows = lapSongs.catalogRows.get(pbGeneration) ??
    fail("PBの全曲リストが周回で読まれていない");
  const manifest = assembleManifest({
    freedPbFiles: videos.freed,
    pbBacks: charted.pbBacks,
    pbLevels: untaken(pbLevelsOf(ports, pbRows)),
    pbVersions: untaken(pbVersionsOf(ports, pbRows)),
    pbVideoRedirects: videos.redirects,
    sharedVideoAbcIndex: ports.fallbackVideoAbcIndex,
    songs: withSortTitles(
      videos.songs,
      pbSongmap.songs,
      charted.pbBacks,
      lapSongs.sources.index,
      lapSongs.sources.indexTitleOf,
      {
        catalogRowAt: ports.catalogRowAt,
        generations,
        titleOf: ports.titleOf,
        withTitle: ports.withTitle,
      },
    ),
    sources,
    targetSongCount,
  });
  return { detached, manifest, removed, selected };
}

/** manifestを作り、要約を標準出力へ出す。ファイルへは書かない */
export function makeManifest<Elf, Excluded>(
  ports: ManifestBuildPorts<Elf, Excluded>,
  songs: readonly ManifestSongDraft[],
  lapSongs: ManifestLaps<Elf>,
): Pick<BuiltManifest<Excluded>, "manifest" | "removed"> {
  const { detached, manifest, removed, selected } = buildManifest(
    ports,
    songs,
    lapSongs,
  );
  manifestReportLines(manifest, selected, detached).forEach((line) =>
    console.log(line)
  );
  return { manifest, removed };
}
