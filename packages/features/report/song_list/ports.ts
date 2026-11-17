// 曲リストが使う、他の feature の関数と値。実装は app が渡す。

import type {
  AssetReference,
  ChartPrint,
  ChartShape,
  IndividualAssetManifest,
  ListEntry,
  ManifestAsset,
  PbVersions,
  SongOverlay,
  SoundPrint,
  SoundPrintKind,
  SourceOrigin,
} from "@csa/core";

/** 曲の世代とsong_id → 難易度名 → 譜面の中身のハッシュ */
export type ChartPrintsOf = (
  generation: string,
  songId: number,
) => Record<string, ChartPrint>;

/** 曲の世代とsong_id → 難易度名 → 版どうしで比べるための譜面の形 */
export type ChartShapesOf = (
  generation: string,
  songId: number,
) => Record<string, ChartShape>;

/** 行を組む処理が使う */
export interface RowPorts {
  abcIndexOfAsset: (
    manifest: IndividualAssetManifest,
    asset: ManifestAsset,
  ) => number;
  catalogKeyOf: (generation: string, songId: number, line?: number) => string;
  /** PBの曲DBの譜面の並び */
  chartSlots: readonly string[];
  fallbackVideoAbcIndex: number;
  folderShort: (folder: number) => string;
  newAbcIndices: (manifest: IndividualAssetManifest) => number[][];
  sourceFolderOf: (
    generation: string,
    origin: SourceOrigin,
  ) => number | string | undefined;
}

/** 周回で原盤から長さとハッシュを求める処理が使う */
export interface LapMeasurePorts {
  contentLength: (
    size: number,
    read: (offset: number, length: number) => Promise<Uint8Array>,
  ) => Promise<number>;
  dataArchive: string;
  ifPayloadLength: (
    read: (offset: number, length: number) => Promise<Uint8Array>,
  ) => Promise<number>;
  isLegacyOverlay: (generation: string) => boolean;
  /** 曲が使う`IFs`を引く関数を作る */
  legacyOverlayFiles: (generation: string, elf: Uint8Array) => (
    songId: number,
  ) => {
    entry: { archive: string; offset: number; size: number };
    serial: number;
  } | null;
  /** 曲DBエントリが指すオーバーレイの DATA1 番号。legacy の世代では使わない */
  overlayPackagesOf: (
    generation: string,
    elf: Uint8Array,
    songId: number,
  ) => readonly number[];
  pbEntryOf: (elf: Uint8Array, songId: number) => Uint8Array;
  pbOverlayOf: (entry: Uint8Array) => SongOverlay;
  pbTocFileOffset: number;
  printOf: (bytes: Uint8Array) => Promise<string>;
  soundPrint: (kind: SoundPrintKind, bytes: Uint8Array) => Promise<SoundPrint>;
  sourceTocFileOffset: (generation: string) => number;
  tocRowOf: (
    elf: Uint8Array,
    tocFileOffset: number,
    index: number,
  ) => { count: number; sector: number };
}

/** 曲リストのファイルを書く処理が使う。`S`は周回で読んだ素材で、譜面の読み出しだけが中身を読む */
export interface SongListWritePorts<S> extends RowPorts {
  /** 曲DBエントリの文字列から、ムービー欄が指すABC indexを読む */
  entryVideoAbcIndex: (entry: string) => number;
  /** 5鍵盤版のエントリーへ、表の曲の値を写す */
  applyFiveKeyFields: (
    song: { abcReferences: readonly AssetReference[]; entry: Uint8Array },
    frontEntry: Uint8Array,
    ownLevels: boolean,
  ) => Uint8Array;
  chartPrintsReader: (sources: S) => ChartPrintsOf;
  chartShapesReader: (sources: S) => ChartShapesOf;
  contentLength: LapMeasurePorts["contentLength"];
  copyPathOf: (
    discsDirectory: string,
    generation: string,
    asset: ManifestAsset,
  ) => string;
  decodeEntry: (entry: string) => Uint8Array;
  difficultyNameOfChartField: (fieldOffset: number) => string;
  discsDirectory: string;
  generations: readonly string[];
  /** 曲DBエントリを、エントリの作品番号から決まる枠で読む */
  listEntryOf: (entry: Uint8Array) => ListEntry;
  movieAliases: () => ReadonlyMap<string, string>;
  /** PB原盤の曲DBエントリを、作品番号をCSAの番号に置き換えて読む */
  pbListEntryOf: (
    entry: Uint8Array,
    songId: number,
    folders: PbVersions,
  ) => ListEntry;
  pbVersionsOf: (
    manifest: { pbVersions?: { songIndex: number; version: number }[] },
  ) => PbVersions;
  printOf: LapMeasurePorts["printOf"];
  readFileAt: (
    path: string,
    offset: number,
    length: number,
  ) => Promise<Uint8Array>;
  soundPrint: LapMeasurePorts["soundPrint"];
  versionFolder: (version: number) => number;
  withPbVersion: (
    entry: Uint8Array,
    songId: number,
    folders: PbVersions,
  ) => Uint8Array;
}
