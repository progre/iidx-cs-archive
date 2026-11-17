// 載せる曲の中で同じ内容のムービーを1本へ揃える。採用元の世代も素材として渡す。
// 採用しない版を使うPBの曲は、PBの曲DBの書き換えにする。書き換えで空いたPBのファイルも返す。

import type {
  FreedPbFile,
  ManifestSong,
  ManifestSongDraft,
  PbVideoRedirect,
  SongmapSong,
} from "@csa/core";
import {
  type AdoptionSources,
  readVideoAdoptionTable,
  type SongId,
  type VideoAdoption,
  type VideoAdoptionRow,
  videoAdoptionsOf,
} from "../adoption/mod.ts";
import {
  adoptionsOf,
  adoptVideos,
  redirectPbVideos,
} from "../video_adoption/mod.ts";
import type { IndexDoc } from "../../index/mod.ts";
import type { ManifestBuildPorts, ManifestLaps } from "./ports.ts";

// 同じ内容のムービーの差し替え表を読む。採用の判断は`adoption/`が決める。
export function loadVideoAdoptions(index: IndexDoc): VideoAdoptionRow[] {
  return videoAdoptionsOf(readVideoAdoptionTable(), index);
}

type Ports<Elf> = Pick<
  ManifestBuildPorts<Elf, unknown>,
  "adoption" | "moviePicks" | "pbGeneration"
>;

/** 差し替え表とムービーの別名の表を読み、採用するムービーを曲ごとに決める */
const loadAdoptions = <Elf>(
  { moviePicks }: Ports<Elf>,
  index: IndexDoc,
  sources: AdoptionSources,
): VideoAdoption[] =>
  adoptionsOf(loadVideoAdoptions(index), moviePicks(), sources);

export interface AdoptedVideos<S extends ManifestSong> {
  freed: FreedPbFile[];
  redirects: PbVideoRedirect[];
  songs: S[];
}

/**
 * PBの曲が使わなくなったファイル(`freedPbFiles`)の場所には、追加曲のファイルを書く。
 * `share`を書いた曲は、PBの曲の音をそのまま使う。
 * その音がこの一覧に入っていると、追加曲のファイルが音の場所に書かれてしまうので、ビルドを止める
 */
function assertSharedSoundsKept(
  songs: readonly ManifestSong[],
  freed: readonly FreedPbFile[],
  pbSongs: readonly SongmapSong[],
): void {
  const freedIndices = new Set(freed.map((file) => file.abcIndex));
  for (const song of songs) {
    const pbSong = pbSongs.find((each) =>
      each.song_id === song.sharedWith?.targetSongIndex
    );
    const reused = (pbSong?.sounds ?? [])
      .flatMap((pair) => [pair.keysound, pair.bgm])
      .filter((index) => index !== null && freedIndices.has(index));
    if (reused.length > 0) {
      throw new Error(
        `${song.title}が共有するPBの音${
          reused.join(", ")
        }が、空いたファイルに数えられている`,
      );
    }
  }
}

/**
 * `built`は載せる曲、`songs`は採用元になれる全世代の候補、`pbSongmap`はPB原盤のsongmapである。
 * 採用元の世代は`registerSource`で素材に加える。
 * `keepsPbSong`は、差し替えを通すPBの曲を選ぶ。表の曲に枠を譲ったPBの曲は通さない
 */
export function adoptedVideos<S extends ManifestSong, Elf>(
  ports: Ports<Elf>,
  built: S[],
  songs: readonly ManifestSongDraft[],
  pbSongmap: AdoptionSources["pbSongmap"] & {
    songs: readonly SongmapSong[];
  },
  lapSongs: Pick<ManifestLaps<Elf>, "bytes" | "sources">,
  registerSource: (generation: string) => void,
  keepsPbSong: (adoption: { song: SongId }) => boolean,
): AdoptedVideos<S> {
  const adoptionFrom = {
    pbSongmap,
    songs,
    videoFlagsOf: ({ generation, songId }: SongId) => {
      if (generation !== ports.pbGeneration) {
        registerSource(generation);
      }
      return lapSongs.bytes.videoFlagsOf(generation, songId);
    },
    ports: ports.adoption,
  };
  const adoptions = loadAdoptions(
    ports,
    lapSongs.sources.index,
    adoptionFrom,
  );
  const adoption = adoptVideos(built, adoptions, adoptionFrom);
  const pbVideos = redirectPbVideos(
    adoptions.filter(keepsPbSong),
    adoptionFrom,
  );
  assertSharedSoundsKept(adoption.songs, pbVideos.freed, pbSongmap.songs);
  console.error(
    `songs with unified identical movies: ${adoption.adopted} / ` +
      `rewritten PB songs: ${pbVideos.redirects.length} / ` +
      `freed PB files: ${pbVideos.freed.length}`,
  );
  return { ...pbVideos, songs: adoption.songs };
}
