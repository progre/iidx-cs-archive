// 収録の候補の1曲に、下書きと仕上げの値を埋める。
// 曲DBエントリはdjt・empなら`copied.ts`が素材ELFから写し、3rd〜goldなら`synthesized.ts`が合成する。
// 世代の中で決まる部分(`draftManifestSong`)は周回で作る。
// 全世代の収録を見て決まる作品番号は、周回の後に`finishManifestSong`が書く。ELFは読まない。

import type {
  CatalogRow,
  FinishedSong,
  ManifestSongDraft,
  ManifestUncorrected,
  SongmapFile,
  SongmapSong,
} from "@csa/core";
import {
  uncorrectedOf,
  withBeginnerLimit,
  withLevels,
  withoutCharts,
} from "../manifest/mod.ts";
import {
  keysoundBytesOf,
  pbSongOf,
  withPbSounds,
  withPlayBuffer,
} from "../manifest/entry/mod.ts";
import { writeEntryVersion } from "../pb/mod.ts";
import { copiedDraft } from "./copied.ts";
import type { DraftedSong, DraftPorts, LoadedSource } from "./sources.ts";
import { synthesizedDraft } from "./synthesized.ts";

/** 全世代の収録を見て決まる、曲へ書く作品番号の規則 */
export interface EntryFolderRules {
  /** 全曲リストの`folder`で変えた曲の、変える前の作品番号 */
  overriddenFrom(row: ManifestSongDraft): number | null | undefined;
  versionOf(row: ManifestSongDraft): number;
}

const SHARED_KINDS: readonly string[] = ["bgm", "keysound"];

function required<T>(
  value: T | undefined,
  song: ManifestSongDraft,
  name: string,
): T {
  if (value === undefined) {
    throw new Error(
      `${song.sourceGeneration} song${song.sourceSongIndex}の${name}が決まっていない`,
    );
  }
  return value;
}

/**
 * 素材・曲名カード・オーバーレイの参照と、作品番号を書く前のエントリを埋める。
 * 全曲リストで外した譜面と、`share`でPB原盤の曲と共有する音とオーバーレイは、ここで外す
 */
export function draftManifestSong<Legacy>(
  ports: DraftPorts<Legacy>,
  row: ManifestSongDraft,
  source: LoadedSource<Legacy>,
): DraftedSong {
  const drafted = ports.songDbPathOf(row.sourceGeneration) === "copy"
    ? copiedDraft(ports, row, source)
    : synthesizedDraft(ports, row, source);
  const { assets } = drafted;
  const charted = row.excludedCharts === undefined
    ? assets
    : withoutCharts(ports.format, assets, row.excludedCharts);
  const sourceOverlay = ports.sourceOverlayOf(row, source);
  if (row.share === undefined) {
    return { ...drafted, assets: charted, sourceOverlay };
  }
  const { overlay: _, ...withoutOverlay } = drafted;
  return {
    ...withoutOverlay,
    sourceOverlay,
    assets: charted.filter((asset) => !SHARED_KINDS.includes(asset.kind)),
  };
}

/** 共有BGAを使う曲は、manifestの`assets`に原作のムービーを持たない。そこで、素材のムービーを`uncorrected.videos`に書く */
function withSharedVideos(
  song: ManifestSongDraft,
  uncorrected: ManifestUncorrected | undefined,
): ManifestUncorrected | undefined {
  const videos = song.sourceAssets.filter((asset) => asset.kind === "video");
  if ((song.videoFields ?? []).length === 0 || videos.length === 0) {
    return uncorrected;
  }
  return {
    ...uncorrected,
    videos: videos.map(({ sourceFileIndex }) => ({
      sourceFileIndex,
      sourceGeneration: song.sourceGeneration,
    })),
  };
}

/** 全部の欄が埋まったことを確かめて、収録する曲として返す */
function completed(song: ManifestSongDraft): FinishedSong {
  required(song.assets, song, "資産");
  required(song.entry, song, "曲DBエントリー");
  required(song.targetSongIndex, song, "曲index");
  required(song.videoFields, song, "動画の欄");
  required(song.sourceOverlay, song, "曲を採った世代のオーバーレイ");
  if (song.fiveKeyOf !== undefined) {
    required(song.fiveKeyOf.targetSongIndex, song, "5鍵盤版の表の曲index");
  }
  if (song.variantOf !== undefined) {
    required(
      song.variantOf.targetSongIndex,
      song,
      "裏エントリーの差し替え元の曲index",
    );
  }
  return song as FinishedSong;
}

/**
 * 周回の後に、作品番号と全曲リストの難易度を書き、manifestの1曲に仕上げる。
 * 難易度を書いた後、SP BEGINNER のレベルが3を超えていれば3にする。
 * 補正で変わった値は、補正前の値も残す。
 * 曲indexと組の相手の曲indexは、呼ぶ前に埋めておく。
 * `catalogRows`は、曲番号から全曲リストの行を引く表である。表は、曲の世代の全曲リストから作る。
 * `pbSongmap`は PB原盤の songmap で、音を共有する曲が使う。
 * 演奏画面バッファの印は、曲が使うキー音バンクの大きさで決める(`withPlayBuffer`)。
 */
export function finishManifestSong<Legacy>(
  { format, levels }: Pick<DraftPorts<Legacy>, "format" | "levels">,
  song: ManifestSongDraft,
  catalogRows: Map<number, Pick<CatalogRow, "levels">>,
  folders: EntryFolderRules,
  pbSongmap: {
    files: readonly SongmapFile[];
    songs: readonly SongmapSong[];
  },
): FinishedSong {
  const draftEntry = required(song.draftEntry, song, "下書きのエントリー");
  const version = folders.versionOf(song);
  const versioned = draftEntry.slice();
  writeEntryVersion(format, versioned, version);
  const leveled = withBeginnerLimit(
    format,
    withLevels(
      levels,
      format,
      format.encode(versioned),
      song,
      catalogRows,
    ),
  );
  const pbSong = song.share === undefined
    ? undefined
    : pbSongOf(song, pbSongmap.songs);
  const entry = withPlayBuffer(
    format,
    pbSong === undefined
      ? leveled
      : withPbSounds(format, leveled, song, pbSong),
    keysoundBytesOf(song, pbSong, pbSongmap.files),
  );
  const uncorrected = withSharedVideos(
    song,
    uncorrectedOf(
      format,
      draftEntry,
      format.decode(entry),
      folders.overriddenFrom(song),
      version,
    ),
  );
  return completed({
    ...song,
    entry,
    ...(pbSong === undefined
      ? {}
      : { sharedWith: { targetSongIndex: pbSong.song_id } }),
    ...(uncorrected === undefined ? {} : { uncorrected }),
  });
}
