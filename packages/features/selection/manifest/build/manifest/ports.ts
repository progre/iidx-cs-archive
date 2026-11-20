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
  /** CSAがその世代のムービーを変換するか */
  convertsVideo: (generation: string) => boolean;
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
  /** `世代:番号` → ムービーの別名。並びは表の行の順である */
  movieAliases: () => ReadonlyMap<string, string>;
  /** PBの世代ID */
  pbGeneration: string;
  /**
   * 組のセーブの曲index。全世代の全曲リストから決めるので、原盤が欠けても変わらない。
   * `count`は99以降の曲indexの数。`indexOf`は世代と全曲リストの行番号から引き、
   * オーナーがPBの組の行には`undefined`を返す
   */
  saveSlots: {
    count: number;
    indexOf: (generation: string, line: number) => number | undefined;
  };
  /** ムービーを変換する世代の中で、同じ映像のムービーから優先して採る世代 */
  preferredConvertedVideoGeneration: string;
  sourceManifestOf: (generation: string) => ManifestSource;
  tables: VersionTables;
  /** 曲DBエントリーの曲名 */
  titleOf: (entry: string) => string;
  withTitle: (entry: string, title: string) => string;
}
