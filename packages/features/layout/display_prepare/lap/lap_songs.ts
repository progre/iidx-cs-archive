// 周回で整えた曲名カードとオーバーレイの参照を、曲ごとに残し、周回の後に最終の選曲へ当てはめる。
// 周回の後は、曲名カードとオーバーレイを作り直さない。

import {
  type DisplaySong,
  type ManifestOverlay,
  type ManifestSong,
  type ManifestTitleCard,
  parseGeneratedSource,
} from "@csa/core";

/** 周回で整えた、1曲の曲名カードとオーバーレイ */
export interface LapDisplaySong {
  /** レイヤーを出すはずなのに、枠を1つも作れなかった */
  dropped: boolean;
  /**
   * この曲が使う`.if`。
   * オーバーレイが読み込み領域の上限を超えると、場面ごとの`.if`に分ける。そのときは、元の`.if`と場面ごとの`.if`の両方を入れる。
   */
  files: string[];
  overlay?: ManifestOverlay;
  titleCard?: ManifestTitleCard;
}

const keyOf = (song: DisplaySong) =>
  song.sourceGeneration + "/" + song.sourceSongIndex;

const filesOf = (song: DisplaySong): string[] =>
  [
    song.titleCard?.sourceArchive,
    ...(song.overlay?.packages ?? []).map((item) => item.sourceArchive),
  ].flatMap((archive) => {
    const source = archive === undefined
      ? undefined
      : parseGeneratedSource(archive);
    return source?.kind === "file" ? [source.name] : [];
  });

/** `repacked`は分ける前の曲で、並びは`songs`と同じである */
export function lapDisplaySongs(
  songs: readonly DisplaySong[],
  repacked: readonly DisplaySong[],
  droppedKeys: ReadonlySet<string>,
): Map<string, LapDisplaySong> {
  return new Map(songs.map((song, at) => [keyOf(song), {
    dropped: droppedKeys.has(keyOf(song)),
    files: [...new Set([...filesOf(repacked[at]), ...filesOf(song)])],
    ...(song.overlay === undefined ? {} : { overlay: song.overlay }),
    ...(song.titleCard === undefined ? {} : { titleCard: song.titleCard }),
  }]));
}

export interface AppliedDisplay {
  /** レイヤーを作れなかった曲。`<世代> <曲名>`の形で、manifest の曲と同じ順に並べる */
  dropped: string[];
  /** 最終の選曲が使う`.if` */
  files: string[];
  songs: ManifestSong[];
}

/** 周回の結果が無い曲は、例外にする */
export function applyLapDisplay(
  songs: readonly ManifestSong[],
  lapSongs: ReadonlyMap<string, LapDisplaySong>,
): AppliedDisplay {
  const files = new Set<string>();
  const dropped: string[] = [];
  const applied = songs.map((song) => {
    const found = lapSongs.get(keyOf(song));
    if (found === undefined) {
      throw new Error(
        `${keyOf(song)}の曲名カードとオーバーレイが周回で作られていない`,
      );
    }
    found.files.forEach((path) => files.add(path));
    if (found.dropped) {
      dropped.push(`${song.sourceGeneration} ${song.title}`);
    }
    // 元の曲にあるキーは、同じ位置のまま値だけを差し替える
    const next = { ...song };
    if (found.overlay === undefined) {
      delete next.overlay;
    } else {
      next.overlay = found.overlay;
    }
    if (found.titleCard === undefined) {
      delete next.titleCard;
    } else {
      next.titleCard = found.titleCard;
    }
    return next;
  });
  return { dropped, files: [...files], songs: applied };
}
