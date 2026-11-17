// 曲の下書きが使う、他の feature の関数と、世代の素材の入力(songmap・ELF)。実装は app が渡す。
// 曲DBを写す世代か合成する世代かは、`songDbPathOf`が決める。

import type {
  AssetReference,
  ChartStats,
  ElfDefinition,
  ExcludedSong,
  ManifestAsset,
  ManifestOverlay,
  ManifestSong,
  ManifestSongDraft,
  ManifestSource,
  ManifestTitleCard,
  SongmapDoc,
  SongmapSong,
  SongOverlay,
} from "@csa/core";
import type { readFileFields } from "../pb/mod.ts";
import type { PbEntryFormat } from "../pb/format/mod.ts";
import type { LevelPorts } from "../manifest/mod.ts";

/** 周回の中だけで使う。統計を引く`statsOf`が平文の譜面を持つので、周回の後へ持ち越さない */
export interface LoadedSource<Legacy> {
  elf: Uint8Array;
  manifest: ManifestSource;
  /** 曲DBを写せる(PBと同じ0x134エントリの)世代なら真 */
  copied: boolean;
  generation: string;
  /** legacyのオーバーレイの世代だけが持つ。中身は`overlayOf`たちだけが読む */
  legacy: Legacy | null;
  songmap: SongmapDoc;
  /** 譜面のファイルの通し番号から、譜面の統計を引く */
  statsOf: (index: number) => ChartStats;
}

export interface DraftPorts<Legacy> {
  adoptedVideosOf: (
    row: ManifestSongDraft,
  ) => { needsLargeBuffer: boolean; sourceFileIndex: number }[];
  copiedAssets: (
    row: ManifestSongDraft,
    songmap: SongmapDoc,
    references: ReturnType<typeof readFileFields>,
    fallbackVideo: boolean,
  ) => Pick<ManifestSong, "assets" | "videoFields">;
  definitionOf: (generation: string) => ElfDefinition;
  /** PB形式の曲DBエントリの形 */
  format: PbEntryFormat;
  isPlayable: (row: ManifestSongDraft) => boolean;
  levels: LevelPorts;
  /** オーバーレイを持たない曲は`undefined`を返す。`entry`はPB形式の曲DBエントリである */
  overlayOf: (
    row: ManifestSongDraft,
    source: LoadedSource<Legacy>,
    entry: Uint8Array,
  ) => ManifestOverlay | undefined;
  /** 再生できない曲なら例外にする */
  requirePlayable: (row: ManifestSongDraft, playable: boolean) => void;
  songDbPathOf: (generation: string) => "copy" | "synthesize";
  songmapSongOf: (
    row: ManifestSongDraft,
    songs: readonly SongmapSong[],
  ) => SongmapSong;
  /** 曲を採った世代の曲DBエントリから、オーバーレイのパッケージ番号と枚数を読む */
  sourceOverlayOf: (
    row: ManifestSongDraft,
    source: LoadedSource<Legacy>,
  ) => SongOverlay;
  synthesizedAssets: (
    row: ManifestSongDraft,
    references: ReadonlyMap<number, AssetReference[]>,
  ) => ManifestAsset[];
  /** 曲名カードの配置が分からない世代は`undefined`を返す */
  titleCardOf: (
    row: ManifestSongDraft,
    source: LoadedSource<Legacy>,
  ) => ManifestTitleCard | undefined;
}

/** 下書きを作った曲。`assets`と`videoFields`は、下書きを作ると決まる */
export type DraftedSong = Omit<ExcludedSong, "entry">;

/** 下書きのうち、作品番号を書く前に決まる部分 */
export type DraftBody = Omit<DraftedSong, "sourceOverlay">;
