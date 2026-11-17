// 表の1行をmanifestの1曲にする判断。
// 曲DBエントリを素材ELFから写す曲と、合成する曲とで、資産の求め方が違う。

import type {
  AssetReference,
  ManifestAsset,
  ManifestSong,
  ManifestSongDraft,
  Resolution,
  SongmapSong,
  SourceAsset,
} from "@csa/core";
import { KIND_ORDER } from "../candidates/assets/mod.ts";
import {
  type EntryFileReferences,
  manifestAssetsOf,
  type SongmapFileSlice,
} from "./assets.ts";
import { assetSource, type ConvertedFile } from "./video.ts";

function fail(message: string): never {
  throw new Error(message);
}

/** 行の曲を、世代のsongmapの曲から探す */
export function songmapSongOf(
  row: ManifestSongDraft,
  songs: readonly SongmapSong[],
): SongmapSong {
  return songs.find((song) => song.song_id === row.sourceSongIndex) ??
    fail(`${row.sourceGeneration} song${row.sourceSongIndex}がsongmapに無い`);
}

/**
 * エントリを写す曲の資産。
 * 曲DBから辿った資産は、表がsongmapから数えた資産と1件ずつ対応しなければならない。
 * 動画として共有BGAを参照させる曲(`fallbackVideo`)では、表の動画を数えない。
 */
export function copiedAssets(
  row: ManifestSongDraft,
  songmap: {
    files: readonly SongmapFileSlice[];
    songs: readonly SongmapSong[];
  },
  references: EntryFileReferences,
  fallbackVideo: boolean,
): Pick<ManifestSong, "assets" | "videoFields"> {
  const built = manifestAssetsOf(
    songmapSongOf(row, songmap.songs),
    songmap.files,
    references,
    fallbackVideo,
  );
  const expected =
    row.sourceAssets.filter((asset) =>
      asset.path !== "excluded" && !(fallbackVideo && asset.kind === "video")
    ).length;
  if (built.assets.length !== expected) {
    fail(
      `${row.sourceGeneration} song${row.sourceSongIndex} ABC件数 ${built.assets.length} != 表 ${expected}`,
    );
  }
  return built;
}

/** 合成する曲は、原作のムービーをそのまま置けなければならない */
export function requirePlayable(
  row: ManifestSongDraft,
  playable: boolean,
): void {
  if (!playable) {
    fail(
      `${row.sourceGeneration} song${row.sourceSongIndex} のムービーはPBで再生できない`,
    );
  }
}

/** 素材のムービーが何本目か。songmapは、何本目かをムービーの欄の名前にする */
const slotOf = (asset: SourceAsset) => Number(asset.fields[0]);

/**
 * 採用するムービーを、何本目かの順に並べる。
 * PBの曲DBが持てるのは2本までで、大きいバッファーの印は曲に1つしか無い。
 * この前提を、`synthesizeEntry`の代わりにここで確かめる
 */
export function adoptedVideosOf(
  row: ManifestSongDraft,
  needsLargeBuffer: (resolution: Resolution) => boolean,
): { needsLargeBuffer: boolean; sourceFileIndex: number }[] {
  const videos = row.sourceAssets
    .filter((asset) => asset.kind === "video" && asset.path !== "excluded")
    .sort((a, b) => slotOf(a) - slotOf(b))
    .map((video) => ({
      needsLargeBuffer: video.resolution !== undefined &&
        needsLargeBuffer(video.resolution),
      sourceFileIndex: video.sourceFileIndex,
    }));
  const song = `${row.sourceGeneration} song${row.sourceSongIndex}`;
  if (videos.length > 2) {
    fail(`${song} 採用ムービーが${videos.length}本ある`);
  }
  if (new Set(videos.map((video) => video.needsLargeBuffer)).size > 1) {
    fail(`${song} 大きいバッファーが要るムービーと要らないムービーがある`);
  }
  return videos;
}

/**
 * エントリを合成する曲の資産。
 * `references`は、素材のファイルを参照するフィールドである。
 * この値は、合成の処理が決める。
 */
export function synthesizedAssets(
  row: ManifestSongDraft,
  references: ReadonlyMap<number, AssetReference[]>,
  convertedFileOf: (output: string) => ConvertedFile,
): ManifestAsset[] {
  return row.sourceAssets.filter((asset) => asset.path !== "excluded").map(
    (asset): ManifestAsset => ({
      kind: asset.kind,
      references: references.get(asset.sourceFileIndex) ??
        fail(
          `${row.sourceGeneration} song${row.sourceSongIndex} file${asset.sourceFileIndex} を参照するフィールドが無い`,
        ),
      ...assetSource(asset, convertedFileOf),
    }),
  ).sort((a, b) =>
    KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
    a.references[0].fieldOffset - b.references[0].fieldOffset
  );
}
