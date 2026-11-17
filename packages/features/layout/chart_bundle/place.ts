// 素材世代ごとのPB chart bundleについて、manifestの書き換えと、書き出す記録の内容を決める。
// bundleは、世代ごとに1本ある。素材世代の譜面をPB鍵で暗号化し、並べたものである。
// ファイルには書かず、ISOの書き込みのときに1件ずつ暗号化する。ここは位置と大きさだけを決める。
// 譜面ファイル名は世代内のfile indexなので、世代をまたぐと同名で別物になる。
// 1本へまとめず別sourceのまま置くことで、offsetの付け替えを避ける。
// 譜面の読み込みと暗号化は `app/ports/media/charts.ts` が行う。

import {
  generatedSourceArchive,
  type IndividualAssetManifest,
} from "@csa/core";

// PB chart bundleのindexの型と、世代のmanifestに載っている譜面のsource file indexを求める。
/** index内の譜面1件。bundle内の位置と大きさを持つ */
export interface PackedChartRow {
  offset: number;
  plainSize: number;
  size: number;
  sourceFileIndex: number;
}

/** bundle内の各譜面の位置を並べたindex。`contents/chart`が作る形と同じである */
export interface PackedChartIndex {
  bundleBytes: number;
  charts: PackedChartRow[];
  plainBytes: number;
}

/** 世代のmanifestに載っている譜面のsource file index */
export function chartSourceFileIndices(
  source: IndividualAssetManifest,
  generation: string,
): Set<number> {
  return new Set(
    source.songs
      .filter((song) => song.sourceGeneration === generation)
      .flatMap((song) => song.assets)
      .filter((asset) => asset.kind === "chart")
      .map((asset) => asset.sourceFileIndex),
  );
}

function fail(message: string): never {
  throw new Error(message);
}

/** 世代の譜面資産をbundle内の位置へ向け、要約の1行を返す */
export function placePackedCharts(
  manifest: IndividualAssetManifest,
  generation: string,
  index: PackedChartIndex,
): string {
  const rows = new Map(index.charts.map((row) => [row.sourceFileIndex, row]));
  if (rows.size !== index.charts.length) {
    fail(`${generation}のPB chart indexが重複している`);
  }
  const used = new Set<number>();
  for (const song of manifest.songs) {
    if (song.sourceGeneration !== generation) {
      continue;
    }
    for (const asset of song.assets) {
      if (asset.kind !== "chart") {
        continue;
      }
      const row = rows.get(asset.sourceFileIndex) ??
        fail(
          `${generation}のPB chart indexにfile ${asset.sourceFileIndex}が無い`,
        );
      asset.sourceArchive = generatedSourceArchive("chartBundle", generation);
      asset.sourceOffset = row.offset;
      asset.sourceSize = row.size;
      used.add(asset.sourceFileIndex);
    }
  }
  if (used.size !== rows.size) {
    fail(
      `${generation}のPB chart index ${rows.size}件に対して使用${used.size}件`,
    );
  }
  return `${generation} ${index.charts.length} charts / plain ${index.plainBytes}B / packed ${index.bundleBytes}B`;
}
