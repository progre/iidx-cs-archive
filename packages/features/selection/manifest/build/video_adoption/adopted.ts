// 採用した1本が、CSAに置く資産か、PBにあるABC indexかを決める。
// 曲DB`+0x62`のbit0(横に引き伸ばす)とbit1(480x480)は、差し替え表の`adopt`列の曲(採用元の曲)の値に合わせる。

import type { ManifestAsset, ManifestSongDraft, SourceAsset } from "@csa/core";
import { assetSource } from "../../song/mod.ts";
import type { AdoptionSources, SongId } from "../adoption/mod.ts";

export const FLAG_BITS = 0x03;
const STRETCH = 0x01;
const LARGE = 0x02;

/** 採用した1本。`asset`はCSAに置く資産、`abcIndex`はPBにすでにあるABC indexである */
export type Adopted =
  & { flags: number }
  & ({ asset: ManifestAsset } | { abcIndex: number });

function fail(message: string): never {
  throw new Error(message);
}

export const keyOf = ({ generation, songId }: SongId) =>
  `${generation}/${songId}`;

const idOf = (song: ManifestSongDraft): SongId => ({
  generation: song.sourceGeneration,
  songId: song.sourceSongIndex,
});

export const usableVideoOf = (assets: SourceAsset[]) =>
  assets.filter(({ kind, path }) => kind === "video" && path !== "excluded");

function stretchOf(sources: AdoptionSources, song: SongId) {
  return sources.videoFlagsOf(song) & STRETCH;
}

/** 同じファイルを使う曲どうしで引き伸ばしの印が食い違うと、どちらに合わせるか決まらない */
function checkStretch(
  sources: AdoptionSources,
  adopt: SongId,
  asset: SourceAsset,
) {
  const expected = stretchOf(sources, adopt);
  const differ = sources.songs
    .filter((song) => song.sourceGeneration === adopt.generation)
    .filter((song) =>
      usableVideoOf(song.sourceAssets).some((other) =>
        other.sourceArchive === asset.sourceArchive &&
        other.sourceOffset === asset.sourceOffset
      )
    )
    .map(idOf)
    .filter((song) => stretchOf(sources, song) !== expected);
  if (differ.length > 0) {
    fail(
      `${keyOf(adopt)}と同じムービーの曲で引き伸ばしの印が違う: ${
        differ.map(keyOf).join(", ")
      }`,
    );
  }
}

/**
 * 同じ曲の候補の行は、裏エントリーなどで複数ある。ANOTHER で流すムービーは、裏の行だけが持つことがある。
 * そこで、全部の行のムービーを集め、重複を除いて songmap のファイル番号の順に並べる
 */
export function videosOfRows(
  rows: readonly ManifestSongDraft[],
): SourceAsset[] {
  const unique = new Map(
    rows.flatMap((row) => usableVideoOf(row.sourceAssets))
      .map((video) => [video.sourceArchive + ":" + video.sourceOffset, video]),
  );
  return [...unique.values()].sort((a, b) =>
    a.sourceFileIndex - b.sourceFileIndex
  );
}

/**
 * `slot`は、採用元の曲の何本目のムービーを使うか。
 * 採用元が CSA で使うムービーを1本しか持たなければ、`slot`に関わらずその1本を使う。
 * era1 の曲では、原作がムービーを2本持ち、CSA はそのうち1本だけを使う。
 * 差し替え表の`adopt_slot`には、その1本が原作で何本目かが書いてある
 */
export function adoptedInCsa(
  sources: AdoptionSources,
  adopt: SongId,
  slot: number,
): Adopted {
  const rows = sources.songs.filter((song) =>
    keyOf(idOf(song)) === keyOf(adopt)
  );
  if (rows.length === 0) {
    fail(`採用元の曲が、載せる候補に無い: ${keyOf(adopt)}`);
  }
  const videos = videosOfRows(rows);
  const video = (videos.length === 1 ? videos.at(0) : videos.at(slot)) ??
    fail(`採用元${keyOf(adopt)}に${slot + 1}本目のムービーが無い`);
  checkStretch(sources, adopt, video);
  const large = video.resolution !== undefined &&
    sources.ports.needsLargeBuffer(video.resolution);
  return {
    asset: {
      kind: "video",
      references: [],
      ...assetSource(video, sources.ports.convertedFileOf),
      sourceGeneration: adopt.generation,
    },
    flags: stretchOf(sources, adopt) | (large ? LARGE : 0),
  };
}

export function adoptedInPb(
  sources: AdoptionSources,
  adopt: SongId,
): { abcIndex: number; flags: number } {
  const song =
    sources.pbSongmap.songs.find((s) => s.song_id === adopt.songId) ??
      fail(`採用元がPBのsongmapに無い: ${keyOf(adopt)}`);
  if (song.videos.length !== 1) {
    fail(`採用元${keyOf(adopt)}のムービーが${song.videos.length}本ある`);
  }
  return {
    abcIndex: song.videos[0],
    flags: sources.videoFlagsOf(adopt) & FLAG_BITS,
  };
}
