// 曲ごとの音とムービーの容量と、ムービーの識別子。
// ムービーは、曲が再生するものを1つに決めてから、識別子と容量をそのムービーから出す。
// 音とムービーの容量は、原作のファイルの、末尾のゼロを除いた長さである。中身が同じファイルは、世代が違っても同じ値になる。

import {
  assetGenerationOf,
  type ManifestSong,
  type SongmapSong,
} from "@csa/core";
import type { SongRow, Video } from "../types.ts";

export type AssetSize = Pick<
  SongRow,
  "soundBytes" | "sounds" | "videoBytes" | "videos"
>;

/** 素材側の識別子から、中身の長さを引く */
export type BytesOf = (source: string) => number;

/** 求めていないファイルを引いたら止める */
export const bytesOfLengths =
  (lengths: ReadonlyMap<string, number>): BytesOf => (source) => {
    const length = lengths.get(source);
    if (length === undefined) {
      throw new Error(`ファイル${source}の長さを求めていない`);
    }
    return length;
  };

/** PBのファイルの識別子 */
const pbSourceOf = (abcIndex: number): string => `pb:${abcIndex}`;

export const pbVideo = (abcIndex: number): Video => ({
  id: abcIndex,
  source: pbSourceOf(abcIndex),
});

/** 同じキー音を複数の譜面が共有するので、識別子ごとに1回だけ数える */
const sizeOf = (
  sounds: ReadonlySet<string>,
  videos: Video[],
  bytesOf: BytesOf,
): AssetSize => ({
  soundBytes: [...sounds].reduce((sum, source) => sum + bytesOf(source), 0),
  sounds: [...sounds],
  videoBytes: videos.reduce((sum, video) => sum + bytesOf(video.source), 0),
  videos,
});

/** 原作のムービーを、再生する1本に添える。再生するムービーが複数あれば、どれに添えるか決まらない */
function withOriginal(
  videos: Video[],
  originals: readonly { sourceFileIndex: number; sourceGeneration: string }[],
): Video[] {
  if (originals.length === 0) {
    return videos;
  }
  if (videos.length !== 1) {
    throw new Error(
      `原作のムービーを添える先が${videos.length}本ある: ${
        videos.map(({ source }) => source).join(", ")
      }`,
    );
  }
  const original = originals
    .map((video) => `${video.sourceGeneration}:${video.sourceFileIndex}`)
    .join(", ");
  return [{ ...videos[0], original }];
}

/**
 * 曲の音とムービー。`abcIndices`は`song.assets`と同じ並びのABC indexで、CSAに置かない曲は空で渡す。
 * 再生するムービーは、次の順に決める。
 * 1. 曲がムービーの資産を持てば、その資産。CSAの別の曲から流用したムービーも、資産として持つ
 * 2. 共有BGAへ向く曲(`videoFields`がある曲)は、共有BGA。曲DBの欄は配置器が後で書く
 * 3. それ以外は、曲DBのムービー欄が指すPBのムービー。PBのムービーを流用した曲である。
 *    外した曲は流用先が決まっていないので、`entryAbcIndex`を渡さない
 */
export function songSize(
  song: Pick<ManifestSong, "assets" | "sourceGeneration" | "videoFields"> & {
    uncorrected?: ManifestSong["uncorrected"];
  },
  abcIndices: readonly number[],
  entryAbcIndex: number | undefined,
  sharedAbcIndex: number,
  bytesOf: BytesOf,
  sharedSounds: readonly string[] = [],
): AssetSize {
  const sounds = new Set<string>(sharedSounds);
  const videos: Video[] = [];
  for (const [index, asset] of song.assets.entries()) {
    const source = `${assetGenerationOf(song, asset)}:${asset.sourceFileIndex}`;
    if (asset.kind === "bgm" || asset.kind === "keysound") {
      sounds.add(source);
    }
    if (asset.kind === "video") {
      videos.push({ id: abcIndices[index], source });
    }
  }
  if (videos.length === 0 && song.videoFields.length > 0) {
    videos.push(pbVideo(sharedAbcIndex));
  } else if (videos.length === 0 && entryAbcIndex !== undefined) {
    videos.push(pbVideo(entryAbcIndex));
  }
  return sizeOf(
    sounds,
    withOriginal(videos, song.uncorrected?.videos ?? []),
    bytesOf,
  );
}

/** PB収録曲の音の識別子 */
const pbSoundSourcesOf = (song: SongmapSong): string[] =>
  song.sounds
    .flatMap((pair) => [pair.bgm, pair.keysound])
    .filter((index) => index !== null)
    .map(pbSourceOf);

/** 全曲リストの`share`で、PB原盤の曲と共有する音の識別子。共有しない曲は空にする */
export function sharedSoundsOf(
  pbSongs: readonly SongmapSong[],
  song: Pick<ManifestSong, "sharedWith">,
): string[] {
  if (song.sharedWith === undefined) {
    return [];
  }
  const { targetSongIndex } = song.sharedWith;
  const found = pbSongs.find((each) => each.song_id === targetSongIndex);
  if (found === undefined) {
    throw new Error(`共有するPBの曲${targetSongIndex}がPBのsongmapに無い`);
  }
  return pbSoundSourcesOf(found);
}

/**
 * PB収録曲。PBの資産はそのまま載るので、素材側の識別子はPBのfile indexになる。
 * songmapの`videos`はABC連結空間のfile indexそのもので、曲DB`+0x58`と一致する。
 * `redirect`は、同じ映像の1本へムービーを差し替えた曲だけが持つ、差し替え先のABC indexである
 */
export function pbSize(
  song: SongmapSong,
  redirect: Video | undefined,
  bytesOf: BytesOf,
): AssetSize {
  const videos = redirect === undefined
    ? [...new Set(song.videos)].map(pbVideo)
    : [{
      ...redirect,
      original: [...new Set(song.videos)].map(pbSourceOf).join(", "),
    }];
  return sizeOf(new Set(pbSoundSourcesOf(song)), videos, bytesOf);
}
