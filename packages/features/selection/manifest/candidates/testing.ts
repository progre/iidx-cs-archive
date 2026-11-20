// candidates/ の単体テストが使う、合成した表と入力。ファイルも実データも使わない。

import type { ManifestSongDraft, SongmapSong, SourceAsset } from "@csa/core";
import type { AssetContext, SourceFile } from "./assets/mod.ts";
import type { Listing } from "./rows/mod.ts";

export const asset = (
  kind: SourceAsset["kind"],
  path: SourceAsset["path"],
  extra: Partial<SourceAsset> = {},
): SourceAsset => ({
  fields: ["a"],
  kind,
  path,
  sourceArchive: "SAMPLE.DAT",
  sourceFileIndex: 1,
  sourceOffset: 0,
  sourceSize: 16,
  ...extra,
});

export const songDraft = (
  generation: string,
  songId: number,
  assets: SourceAsset[],
  extra: Partial<ManifestSongDraft> = {},
): ManifestSongDraft => ({
  canonicalKey: `${generation}:${songId}`,
  sourceAssets: assets,
  sourceGeneration: generation,
  sourceSongIndex: songId,
  title: `title ${songId}`,
  ...extra,
});

export const sourceFile = (index: number, size = 32): SourceFile => ({
  archive: "sample.dat",
  index,
  offset: index * 0x800,
  size,
});

export const songmapSong = (
  songId: number,
  extra: Partial<SongmapSong> = {},
): SongmapSong => ({
  bgm: null,
  charts: { sp_hyper: { chart: 1, level: 7 } },
  keysound: null,
  overlay: null,
  song_id: songId,
  sounds: [],
  title: `title ${songId}`,
  videos: [],
  ...extra,
});

/** 全曲リストの行。外さず、メモも組も無い曲にする */
export const listing = (extra: Partial<Listing> = {}): Listing => ({
  another: null,
  excluded: false,
  excludedCharts: [],
  fiveKeyOf: null,
  levels: {},
  line: 2,
  chartMoves: null,
  note: null,
  share: null,
  ...extra,
});

/** テスト用の差し替え。原盤のファイルの読み出しと、音声の形式の判定は、決まった値を返す。eraはera2 */
export function contextOf(
  generation: string,
  files: SourceFile[],
  extra: Partial<AssetContext> = {},
): AssetContext {
  return {
    era: "era2",
    era1Jobs: new Map(),
    files: new Map(files.map((file) => [file.index, file])),
    generation,
    readResolution: () => Promise.resolve({ height: 240, width: 320 }),
    sameBytes: () => Promise.resolve(false),
    ...extra,
  };
}
