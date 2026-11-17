// 生成したmanifestの内訳を、1行ずつの文章にする。

import type { IndividualAssetManifest, ManifestSongDraft } from "@csa/core";

const countPerGeneration = (
  generations: string[],
  rows: readonly ManifestSongDraft[],
) =>
  generations.map((generation) =>
    generation + "=" +
    rows.filter((row) => row.sourceGeneration === generation).length
  ).join(" ");

export function manifestReportLines(
  manifest: IndividualAssetManifest,
  selected: readonly ManifestSongDraft[],
  detached: readonly ManifestSongDraft[],
): string[] {
  const generations = Object.keys(manifest.sources);
  // 裏エントリーは表と同じ動画を共有するので、内訳は選曲できる曲だけで数える
  const fallbackFronts = manifest.songs.filter((song) =>
    song.videoFields.length > 0 && song.variantOf === undefined
  );
  // 曲名カードの無い曲は、クローン元の表示のまま置かれる。欠落を世代ごとに示す
  const missingTitleCards = generations.map((generation) =>
    generation + "=" +
    manifest.songs.filter((song) =>
      song.sourceGeneration === generation && song.titleCard === undefined
    ).length
  ).filter((entry) => !entry.endsWith("=0")).join(" ");
  return [
    `${manifest.targetSongCount}-song manifest: ${selected.length} songs (${
      countPerGeneration(generations, selected)
    }) / ` +
    `back entries ${
      manifest.songs.length - selected.length
    } / ABC ${manifest.expectedNewAbcCount} / ` +
    `original videos ${
      selected.length - fallbackFronts.length
    } songs, fallback BGA ${fallbackFronts.length} songs`,
    `5-key versions: ${
      selected.filter((row) => row.fiveKeyOf !== undefined).length
    } songs / dropped with an unselected front ${detached.length} songs`,
    `missing title cards: ${missingTitleCards || "none"}`,
  ];
}
