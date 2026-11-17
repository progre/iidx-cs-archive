// 周回の後に、周回で整えた曲名カードとオーバーレイを最終の選曲へ当てはめる。

import { type IndividualAssetManifest, parseGeneratedSource } from "@csa/core";
import { applyLapDisplay, type LapDisplaySong } from "./lap_songs.ts";
import { titleCardSummary } from "../repack.ts";

/** 周回で書いた1世代分の結果のうち、当てはめに使う項目 */
export interface DisplayLapResult {
  /** 置いた`.if` */
  files: string[];
  /** `<世代>/<曲番号>` → 周回で整えた曲名カードとオーバーレイ */
  songs: Map<string, LapDisplaySong>;
}

/** `hasDisplayAssets`は、曲名カードの配置が分かる世代で真を返す */
export function prepareDisplayAfterLaps<
  M extends Pick<IndividualAssetManifest, "songs">,
>(
  hasDisplayAssets: (generation: string) => boolean,
  manifest: M,
  laps: Iterable<DisplayLapResult>,
  discsDirectory: string,
): { files: string[]; manifest: M; summaries: string[] } {
  const lapSongs = new Map([...laps].flatMap((lap) => [...lap.songs]));
  const applied = applyLapDisplay(manifest.songs, lapSongs);
  const repacked =
    applied.songs.filter((song) =>
      hasDisplayAssets(song.sourceGeneration) &&
      song.titleCard !== undefined &&
      parseGeneratedSource(song.titleCard.sourceArchive)?.kind === "file"
    ).length;
  const legacy = applied.songs.filter((song) =>
    !hasDisplayAssets(song.sourceGeneration)
  );
  const overlaySongs =
    applied.songs.filter((song) => song.overlay !== undefined).length;
  return {
    files: applied.files,
    manifest: { ...manifest, songs: applied.songs },
    summaries: [
      titleCardSummary({
        repacked: 0,
        reused: repacked,
        root: discsDirectory,
        // 曲名カード欄がカードを指していないので、カードを組まなかった曲
        skipped: legacy.filter((song) => song.titleCard === undefined)
          .map((song) => `${song.sourceGeneration}/${song.title}`),
        written: legacy.filter((song) => song.titleCard !== undefined).length,
      }),
      `overlays: applied lap results to ${overlaySongs} songs -> ${discsDirectory}` +
      (applied.dropped.length === 0
        ? ""
        : `\nsongs without legacy layers ${applied.dropped.length}: ` +
          applied.dropped.join(", ")),
    ],
  };
}

/** 周回で書いて、最終の選曲では使わないファイル */
export function unusedFiles(
  laps: Iterable<Pick<DisplayLapResult, "files">>,
  used: Iterable<string>,
): string[] {
  const keep = new Set(used);
  const unused = new Set<string>();
  for (const lap of laps) {
    lap.files.filter((path) => !keep.has(path)).forEach((path) =>
      unused.add(path)
    );
  }
  return [...unused];
}
