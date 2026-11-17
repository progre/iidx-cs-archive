// 曲の下書きで曲名カードとオーバーレイの参照を読む処理が使う、他の feature の関数。実装は app が渡す。

import type {
  ArtworkLayout,
  ManifestOverlay,
  ManifestTitleCard,
  SongOverlay,
} from "@csa/core";
import type { LegacyOverlay } from "../../legacy_overlay/mod.ts";

/** sheet形式のオーバーレイの欄。中身は読まず、`sheetOverlayOf`へ渡す */
export interface SheetOverlayFields {
  packages: readonly number[];
  pairs: readonly ({ animation: number; index: number } | null)[];
}

/** 素材世代のDATA1のTOC */
export interface SourceToc {
  archive: string;
  count: number;
  rowOf: (fileIndex: number) => { count: number; sector: number };
}

/** legacyの世代で、周回の素材を作るときに1回だけ割り出す表 */
export interface LegacyOverlaySource {
  /** 曲 → オーバーレイの`.if`のファイル */
  filesOf: (songId: number) => {
    entry: { archive: string; offset: number; size: number };
    serial: number;
  } | null;
  /** ELFの4段表 */
  slots: LegacyOverlay;
}

/** 下書きの処理が読む、周回の素材の項目 */
export interface DraftSource {
  elf: Uint8Array;
  legacy: LegacyOverlaySource | null;
  manifest: { elf: string };
}

export interface DraftOverlayPorts {
  artworkOf: (generation: string) => ArtworkLayout;
  /** PB形式の曲DBエントリのBPM欄。無ければnull */
  bpmOfEntry: (entry: Uint8Array) => { max: number; min: number } | null;
  entryBytesOf: (
    generation: string,
    elf: Uint8Array,
    songId: number,
  ) => Uint8Array;
  entryOffsetOf: (
    generation: string,
    elf: Uint8Array,
    songId: number,
  ) => number;
  isLegacyOverlay: (generation: string) => boolean;
  legacyOverlayOf: (
    animations: readonly (number | null)[],
    fileOf: () => {
      archive: string;
      offset: number;
      serial: number;
      size: number;
    } | null,
    elfTile: () => { animation: number; archive: string },
  ) => ManifestOverlay | undefined;
  /** 曲DBエントリのオーバーレイの欄を読む */
  readSongOverlay: (generation: string, entry: Uint8Array) => SongOverlay;
  /** sheet形式のオーバーレイの欄を読む。sheet形式でない世代は`undefined` */
  sheetFieldsOf: (
    generation: string,
    elf: Uint8Array,
    entryOffset: number,
  ) => SheetOverlayFields | undefined;
  sheetOverlayOf: (
    label: string,
    fields: SheetOverlayFields,
    toc: SourceToc,
  ) => ManifestOverlay | undefined;
  titleCardOf: (
    origin: {
      anotherSprite: number | null;
      generation: string;
      songIndex: number;
    },
    main: number,
    pairs: readonly { animation: number; file: number }[],
    toc: SourceToc,
  ) => ManifestTitleCard;
  tocRowOf: (
    elf: Uint8Array,
    tocFileOffset: number,
    index: number,
  ) => { count: number; sector: number };
}
