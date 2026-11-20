// 同じ内容のムービーの採用が使う入力の型。

import type {
  ManifestSongDraft,
  Resolution,
  SongmapFile,
  SongmapSong,
} from "@csa/core";
import type { ConvertedFile } from "../../song/mod.ts";

export interface SongId {
  generation: string;
  songId: number;
}

/** 曲の`slot`本目のムービーを、`adopt`の`adoptSlot`本目のムービーに差し替える */
export interface VideoAdoption {
  song: SongId;
  /** `song`の何本目のムービーを差し替えるか。曲DBの欄の順で数える */
  slot: number;
  /** 代わりにムービーを使う曲 */
  adopt: SongId;
  /** `adopt`の何本目のムービーを使うか */
  adoptSlot: number;
}

/** 曲の`slot`本目のムービーを、別名の1本に差し替える。別名から採用元の曲を引くのは、ビルドが行う */
export interface AliasAdoption {
  song: SongId;
  slot: number;
  alias: string;
}

/** 採用したムービーを当てる処理が使う、他の feature の関数。実装は app が渡す */
export interface AdoptionPorts {
  /** 変換したムービーのファイルの、アーカイブ名と大きさ */
  convertedFileOf(output: string): ConvertedFile;
  /** 大きいほうの演奏画面バッファが要る解像度か */
  needsLargeBuffer(resolution: Resolution): boolean;
  /** 曲DBのエントリー(符号化済み)のムービーの欄を、`fields`の位置で書き換えた写し */
  redirectVideo(
    entry: string,
    flags: number,
    fields: readonly number[],
    abcIndex: number | undefined,
  ): string;
  /** `slot`本目のムービーの欄の位置 */
  videoFieldOffset(slot: number): number;
  /** 曲DBのエントリー(符号化済み)の、ムービーの印の欄の値。値が無ければ0である */
  videoFlagsOfEntry(entry: string): number;
}

export interface AdoptionSources {
  /** PBのsongmapのうち、採用で使う欄 */
  pbSongmap: {
    files: readonly Omit<SongmapFile, "refs">[];
    songs: readonly Pick<SongmapSong, "song_id" | "videos">[];
  };
  /** 載せる候補の全世代の行 */
  songs: readonly ManifestSongDraft[];
  /** 曲DBのムービーの印の欄の値。世代はPBも含む。値が無ければ0である */
  videoFlagsOf: (song: SongId) => number;
  ports: AdoptionPorts;
}
