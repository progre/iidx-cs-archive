// manifestを作る処理が使う、他の feature の関数と、周回の結果。実装は app が渡す。

import type {
  CatalogRow,
  FinishedSong,
  ManifestSongDraft,
  ManifestSource,
  SongmapFile,
  SongmapSong,
} from "@csa/core";
import type { LapPbBack } from "../../candidates/catalog/mod.ts";
import type { IndexDoc, IndexTitleOf } from "../../index/mod.ts";
import type { AdoptionPorts } from "../adoption/mod.ts";
import type { ByteReader, FolderRules, VersionTables } from "../folder/mod.ts";
import type { adoptionsOf } from "../video_adoption/mod.ts";

/** 周回で読んだ、曲ごとの作品番号と新旧の印と、ムービーの印 */
export interface LapSongBytes {
  newOldAt: ByteReader;
  versionAt: ByteReader;
  videoFlagsOf: (generation: string, songId: number) => number;
}

/** 周回の後にmanifestを仕上げるのに使う値。`Elf`は実行ファイルで、中身は全曲リストの処理だけが読む */
export interface ManifestLaps<Elf> {
  bytes: LapSongBytes;
  /** 世代 → 全曲リストを曲番号から引く表 */
  catalogRows: ReadonlyMap<string, Map<number, CatalogRow>>;
  /** PB 以外の版を表にした組で、裏に回す PB 原盤の曲の写し */
  pbBacks: LapPbBack[];
  sources: {
    elfOf: (generation: string) => Elf;
    index: IndexDoc;
    indexTitleOf: IndexTitleOf;
    songmapOf: (generation: string) => {
      files: readonly SongmapFile[];
      songs: SongmapSong[];
    };
  };
}

/** `Excluded`は全曲リストで外した曲で、曲リストのために曲DBの処理が作る */
export interface ManifestBuildPorts<Elf, Excluded> {
  adoption: AdoptionPorts;
  catalogRowAt: (
    generation: string,
    line: number | undefined,
  ) => CatalogRow | undefined;
  catalogRowsOf: (generation: string, elf: Elf) => Map<number, CatalogRow>;
  chartSlots: readonly string[];
  excludedSongs: (
    songs: readonly ManifestSongDraft[],
    catalogRows: ReadonlyMap<string, Map<number, CatalogRow>>,
    folders: FolderRules,
  ) => Excluded[];
  /** 共有BGAのABC index */
  fallbackVideoAbcIndex: number;
  finishManifestSong: (
    song: ManifestSongDraft,
    catalogRows: Map<number, Pick<CatalogRow, "levels">>,
    folders: FolderRules,
    pbSongmap: {
      files: readonly SongmapFile[];
      songs: readonly SongmapSong[];
    },
  ) => FinishedSong;
  /** 発売順の世代 */
  generations: readonly string[];
  groupedCatalogs: () => readonly {
    generation: string;
    rows: readonly CatalogRow[];
  }[];
  isPlayable: (row: ManifestSongDraft) => boolean;
  /** 全曲リストの譜面の列 → 曲DBの難易度名とレベル */
  levelsByDifficulty: (
    levels: CatalogRow["levels"],
  ) => [name: string, level: number][];
  /** 曲DBエントリーの、難易度のレベル欄の値 */
  levelOf: (entry: string, name: string) => number;
  moviePicks: () => Parameters<typeof adoptionsOf>[1];
  /** PBの世代ID */
  pbGeneration: string;
  sourceManifestOf: (generation: string) => ManifestSource;
  tables: VersionTables;
  /** 曲DBエントリーの曲名 */
  titleOf: (entry: string) => string;
  withTitle: (entry: string, title: string) => string;
}
