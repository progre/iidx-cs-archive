// 周回で作った世代ごとの行を、世代の順につなぐ。つないだ行から、CSAに収録する曲を選ぶ。
// 同じ曲が複数の作品にあれば作品ごとに行を持つ。

import type { ManifestSongDraft } from "@csa/core";

/**
 * ビルダーが載せる行。載せないのは`excluded`の区分だけである。
 * PBが同じ曲を持っていても原作版を落とさない。原作を原作どおりに遊ぶには
 * 譜面もキー音もムービーもその作品のものが要る。
 */
export const buildableSongs = (
  songs: readonly ManifestSongDraft[],
): ManifestSongDraft[] => songs.filter((song) => song.excluded === undefined);

// 1世代の行数と内訳を1行にまとめる。生成中の標準出力に使う。

export function summarize(
  generation: string,
  rows: readonly ManifestSongDraft[],
): string {
  const count = (predicate: (song: ManifestSongDraft) => boolean) =>
    rows.filter(predicate).length;
  const videos = rows.flatMap((song) =>
    song.sourceAssets.filter((asset) => asset.kind === "video")
  );
  const paths = ["reencode", "copy", "excluded"].map((path) =>
    `${path} ${videos.filter((asset) => asset.path === path).length}`
  ).join(" / ");
  return `${generation}: ${rows.length} rows (5-key ${
    count((song) => song.fiveKeyOf !== undefined)
  }, excluded ${count((song) => song.excluded !== undefined)}, no video ${
    count((song) => !song.sourceAssets.some((asset) => asset.kind === "video"))
  }) videos ${paths}`;
}

/** 周回で作った世代ごとの行を、`generations`の順につなぐ。順は呼び出し元が原盤の定義から渡す */
export function assembleSongRows(
  rowsOf: ReadonlyMap<string, readonly ManifestSongDraft[]>,
  generations: readonly string[],
): ManifestSongDraft[] {
  const songs = generations.flatMap((generation) => {
    const rows = rowsOf.get(generation);
    if (rows === undefined) {
      throw new Error(`${generation}の行が周回で作られていない`);
    }
    console.log(summarize(generation, rows));
    return rows;
  });
  console.log(`total ${songs.length} rows`);
  return songs;
}
