// 配置計画のTSV。1曲1行にし、曲ごとのasset列はJSONへ畳んで列数を固定する。
import {
  type IndividualAssetManifest,
  type ManifestSong,
  overlayKey,
  type OverlaySource,
} from "@csa/core";
import type { PlacementPlan } from "../../types.ts";

const HEADER = [
  "record_type",
  "target_song",
  "source_song",
  "title",
  "canonical_key",
  "asset_count",
  "assets_json",
  "title_card_json",
  "overlay_json",
  "start_lba",
  "end_lba",
  "bytes",
];

function clean(value: string | number): string {
  return String(value).replaceAll("\t", " ").replaceAll("\n", " ");
}

/** 曲の指すパッケージの配置。組は`packages`の添字で引くので並びを保つ */
function overlayPackage(
  plan: PlacementPlan,
  generation: string,
  item: OverlaySource,
) {
  const key = overlayKey(generation, item);
  const found = plan.data1.overlayPackages.find((planned) =>
    overlayKey(planned.sourceGeneration, planned) === key
  );
  if (found === undefined) {
    throw new Error(`${key}のオーバーレイ計画が無い`);
  }
  return {
    lba: found.lba,
    newData1Index: found.newData1Index,
    sectors: found.sectors,
    sourceArchive: found.sourceArchive,
    sourceFileIndex: found.sourceFileIndex,
  };
}

function songRow(plan: PlacementPlan, song: ManifestSong): string[] {
  const assets = plan.assets.filter((asset) =>
    asset.targetSongIndex === song.targetSongIndex
  ).map((asset) => ({
    fieldReferences: asset.references.map((reference) =>
      `0x${reference.fieldOffset.toString(16)}:${reference.width}`
    ),
    kind: asset.kind,
    lba: asset.lba,
    newAbcIndex: asset.newAbcIndex,
    sectors: asset.sectors,
    sourceArchive: asset.sourceArchive,
    sourceFileIndex: asset.sourceFileIndex,
    sourceOffset: asset.sourceOffset,
    sourceSize: asset.sourceSize,
  }));
  const card = plan.data1.titleCards.find((entry) =>
    entry.targetSongIndices.includes(song.targetSongIndex)
  );
  if (card === undefined && song.titleCard !== undefined) {
    throw new Error(`song${song.targetSongIndex}の曲名カード計画が無い`);
  }
  const overlay = song.overlay === undefined ? "-" : JSON.stringify({
    packages: song.overlay.packages.map((item) =>
      overlayPackage(plan, song.sourceGeneration, item)
    ),
    pairs: song.overlay.pairs,
  });
  return [
    "song",
    song.targetSongIndex,
    song.sourceSongIndex,
    song.title,
    song.canonicalKey,
    assets.length,
    JSON.stringify(assets),
    card === undefined ? "-" : JSON.stringify({
      lba: card.lba,
      newData1Index: card.newData1Index,
      pairs: song.titleCard?.pairs,
      relativeSector: card.relativeSector,
      sectors: card.sectors,
      sourceFileIndex: card.sourceFileIndex,
    }),
    overlay,
    "-",
    "-",
    "-",
  ].map(clean);
}

export function planReportTsv(
  plan: PlacementPlan,
  manifest: IndividualAssetManifest,
): string {
  const rows = [HEADER.join("\t")];
  const range = plan.assetRange;
  rows.push([
    "assets",
    "",
    "",
    "",
    "",
    plan.placements.length,
    "",
    "",
    "",
    range.startLba,
    range.endLba,
    (range.endLba - range.startLba) * 2048,
  ].join("\t"));
  rows.push([
    "data1",
    "",
    "",
    "",
    "",
    plan.data1.titleCards.length,
    "",
    JSON.stringify(plan.data1.imageSets.map((imageSet) => ({
      data1Index: imageSet.data1Index,
      lba: imageSet.lba,
      relativeSector: imageSet.relativeSector,
      sectors: imageSet.sectors,
      size: imageSet.size,
    }))),
    JSON.stringify(plan.data1.overlayPackages.map((item) => ({
      newData1Index: item.newData1Index,
      sectors: item.sectors,
      source: overlayKey(item.sourceGeneration, item),
    }))),
    plan.data1.startLba,
    plan.data1.endLba,
    (plan.data1.endLba - plan.data1.startLba) * 2048,
  ].join("\t"));
  for (const song of manifest.songs) rows.push(songRow(plan, song).join("\t"));
  return rows.join("\n") + "\n";
}
