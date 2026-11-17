// 曲DB`+0xBC`の`0x100`のbitを書く。演奏画面バッファの大きさを選ぶ印である。
// 演奏画面バッファにはキー音バンクを読み込む。bitが無いと小さいほうのバッファーになり、
// 収まらないバンクはバッファーの後ろを上書きする(PB実測)。
// 素材のエントリーを写す世代は原盤のbitを持つが、合成する世代(3rd〜gold)はこの欄を持たないので、ここで書く。

import type { ManifestSongDraft, SongmapFile, SongmapSong } from "@csa/core";
import type { PbEntryFormat } from "../../pb/format/mod.ts";

/** bitが無い曲の演奏画面バッファの大きさ(`FUN_0013a410`) */
const SMALL_PLAY_BUFFER = 0x708000;
const LARGE_PLAY_BUFFER = 0x100;

/** `keysoundBytes`は、曲が使うキー音バンクのうち最も大きいもののバイト数 */
export function withPlayBuffer(
  format: PbEntryFormat,
  entryText: string,
  keysoundBytes: number,
): string {
  if (keysoundBytes <= SMALL_PLAY_BUFFER) {
    return entryText;
  }
  const entry = format.decode(entryText);
  const artwork = format.recordOf(entry).artwork;
  artwork.unkPbBc = (artwork.unkPbBc ?? 0) | LARGE_PLAY_BUFFER;
  return format.encode(entry);
}

/**
 * 曲が使うキー音バンクのうち、最も大きいもののバイト数。
 * PB原盤の曲と音を共有する曲(`pbSong`)は、その曲のバンクを使う。`pbFiles`はPB原盤のsongmapのファイルである
 */
export function keysoundBytesOf(
  song: Pick<ManifestSongDraft, "sourceAssets">,
  pbSong: Pick<SongmapSong, "sounds"> | undefined,
  pbFiles: readonly Pick<SongmapFile, "size">[],
): number {
  const sizes = pbSong === undefined
    ? song.sourceAssets
      .filter(({ kind }) => kind === "keysound")
      .map(({ sourceSize }) => sourceSize)
    : pbSong.sounds.flatMap(({ keysound }) =>
      keysound === null ? [] : [pbFiles[keysound].size]
    );
  return Math.max(0, ...sizes);
}
