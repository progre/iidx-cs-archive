// 周回で曲名カードとオーバーレイを整える処理が使う、他の feature の関数。実装は app が渡す。
// `.if`の読み書きと絵の組み立ては、受け取った関数が行う。

import type {
  DescriptorStart,
  DisplaySong,
  IndividualAssetManifest,
  ManifestOverlayPackage,
} from "@csa/core";
import type { RepackRequest } from "../repack.ts";
import type { OverlayPart } from "../split/mod.ts";

/** 曲名カードとオーバーレイの準備が読む、manifestの項目 */
export interface DisplayManifest {
  songs: DisplaySong[];
  sources: IndividualAssetManifest["sources"];
}

/** 手順が中身を読まずに次の処理へ渡す値の型。実際の型は app が決める */
export interface DisplayLapTypes {
  disc: unknown;
  elf: unknown;
  /** 曲が使う`IFs`の範囲 */
  ifs: unknown;
  /** 周回で画像セットについて読んだ値 */
  imageSet: unknown;
  repacker: LapRepacker;
}

/** 世代の周回で開いてある原盤 */
export interface LapDisc<Disc> {
  disc: Disc;
  generation: string;
}

export type ElfOf<Elf> = (generation: string) => Elf;

/** 素材のDATA1にある`.if`を並べ替えて書く */
export interface LapRepacker {
  close: () => void;
  paths: () => string[];
  repack: (
    request: RepackRequest,
  ) => Promise<{ path: string; reused: boolean; size: number }>;
}

/** legacyのオーバーレイを組んで書く */
export interface LegacyOverlayWriter<Ifs> {
  lost: (
    song: { generation: string; songId: number },
    hasIfs: boolean,
  ) => boolean;
  write: (input: {
    generation: string;
    holdFrames?: number;
    ifs: Ifs | null;
    songId: number;
  }) => Promise<{ path: string; size: number } | null>;
}

export interface DisplayLapPorts<T extends DisplayLapTypes> {
  /** 素材世代のDATA1アーカイブ名 */
  dataArchive: string;
  descriptorStartOf: (generation: string) => DescriptorStart | null;
  hasDisplayAssets: (generation: string) => boolean;
  /** 世代ごとに、曲が`IFs`を持つかを引く関数を作る */
  ifsReader: (
    elfOf: ElfOf<T["elf"]>,
  ) => (generation: string) => (songId: number) => boolean;
  indicesByGeneration: <T>(
    items: readonly T[],
    generationOf: (item: T) => string,
  ) => number[];
  isLegacyOverlay: (generation: string) => boolean;
  legacyIfsSlice: (
    item: ManifestOverlayPackage,
    elfName: string,
  ) => T["ifs"] | null;
  /** 曲名カードの`.if`を、絵をsheetの左上へ移して書く */
  openCardRepacker: (
    discsDirectory: string,
    lap: LapDisc<T["disc"]>,
  ) => T["repacker"];
  /** 曲番号から、legacyの曲名カードを組んで書く関数を作る。カードを組まない曲はnull */
  openLegacyCardWriter: (
    generation: string,
    elf: T["elf"],
    discsDirectory: string,
  ) => (index: number) => { path: string; size: number } | null;
  openLegacyOverlayWriter: (
    discsDirectory: string,
    repacker: T["repacker"],
    elfOf: ElfOf<T["elf"]>,
  ) => LegacyOverlayWriter<T["ifs"]>;
  openOverlayRepacker: (
    discsDirectory: string,
    lap: LapDisc<T["disc"]>,
  ) => T["repacker"];
  /** PBの曲DBが持てるオーバーレイの本数 */
  packageCount: number;
  readImageSetLap: (input: {
    disc: T["disc"];
    discsDirectory: string;
    elf: T["elf"];
    generation: string;
    songs: readonly DisplaySong[];
  }) => Promise<T["imageSet"]>;
  splitOverlayPackages: (
    manifest: { songs: readonly DisplaySong[] },
    discsDirectory: string,
    lap: LapDisc<T["disc"]>,
  ) => Promise<{ files: string[]; parts: Map<string, OverlayPart[]> }>;
}
