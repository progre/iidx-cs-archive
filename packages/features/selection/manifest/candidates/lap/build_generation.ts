// 1世代分の行を作る。曲ごとに、素材と変換経路を決める処理を呼ぶ。
// 原盤のムービーの中身を読む処理は、呼び出し元が関数にして渡す。

import type { Resolution, SongmapSong } from "@csa/core";
import type { ManifestSongDraft } from "@csa/core";
import type { Era, Era1VideoJob, SourceFile } from "../assets/mod.ts";
import { buildGenerationRows, type Listing } from "../rows/mod.ts";

/** songmapのうち、行を作るのに使う部分 */
export interface GenerationSongmap {
  files: readonly SourceFile[];
  songs: readonly SongmapSong[];
}

/** 原盤のムービーの中身を読む処理 */
export interface VideoProbes {
  readResolution: (file: SourceFile) => Promise<Resolution>;
  sameBytes: (a: SourceFile, b: SourceFile) => Promise<boolean>;
}

export async function buildGeneration(
  generation: string,
  era: Era,
  songmap: GenerationSongmap,
  probes: VideoProbes,
  indexKeyOf: (song: SongmapSong) => string,
  listingsOf: (songId: number) => readonly Listing[],
  era1Jobs: ReadonlyMap<string, Era1VideoJob>,
): Promise<ManifestSongDraft[]> {
  return await buildGenerationRows(
    {
      ...probes,
      era,
      era1Jobs,
      files: new Map(songmap.files.map((file) => [file.index, file])),
      generation,
    },
    songmap.songs,
    indexKeyOf,
    listingsOf,
  );
}
