// 採用しない版を使うPBの曲を、PBの曲DBの書き換えにする。
// 書き換えた曲だけが使っていたPBのムービーのファイルは、どの曲からも使われなくなる。
// CSAが追加する資産は、このファイルの領域に置ける。
// 採用元は、PBの曲でもPB以外の曲でもよい。
// 採用元がPB以外の曲のときは、CSAがそのムービーを新しい資産として置く。
// PBの曲のムービー欄には、その資産のABC indexを書く。

import type { AdoptionSources, VideoAdoption } from "../adoption/mod.ts";
import type { FreedPbFile, PbVideoRedirect } from "@csa/core";
import { adoptedInCsa, adoptedInPb } from "./adopted.ts";

const PB = "pb";

export function redirectPbVideos(
  adoptions: VideoAdoption[],
  sources: AdoptionSources,
): { freed: FreedPbFile[]; redirects: PbVideoRedirect[] } {
  // 採用元がPBの曲ならPBのABC indexへ、PB以外の曲ならCSAが置く資産へ向ける
  const redirects: PbVideoRedirect[] = adoptions
    .filter(({ song }) => song.generation === PB)
    .map(({ song, adopt, adoptSlot }) => ({
      ...(adopt.generation === PB
        ? adoptedInPb(sources, adopt)
        : adoptedInCsa(sources, adopt, adoptSlot)),
      songIndex: song.songId,
    }));
  const redirected = new Set(redirects.map(({ songIndex }) => songIndex));
  const { files, songs } = sources.pbSongmap;
  const stillUsed = new Set([
    ...songs.filter(({ song_id }) => !redirected.has(song_id))
      .flatMap(({ videos }) => videos),
    ...redirects.flatMap((redirect) =>
      "abcIndex" in redirect ? [redirect.abcIndex] : []
    ),
  ]);
  const freedIndices = new Set(
    songs.filter(({ song_id }) => redirected.has(song_id))
      .flatMap(({ videos }) => videos)
      .filter((index) => !stillUsed.has(index)),
  );
  const freed = files
    .filter(({ index }) => freedIndices.has(index))
    .map(({ archive, index, offset, size }) => ({
      abcIndex: index,
      archive,
      offset,
      size,
    }));
  return { freed, redirects };
}
