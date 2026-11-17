// 周回で曲名カードとオーバーレイを整える処理へ、他の feature の実装を渡す。

import {
  HEADER_BYTES,
  IfRepacker,
  type LapDisc,
  packLegacyOverlay,
  packTitleCard,
  padToSector,
  parseAnimations,
  parseIfPackage,
  parseIfWithAnimations,
  repackIfPackage,
  titleCardPath,
  withSpritesAtSheetOrigin,
  writeIfFile,
  writeTitleCard,
} from "@csa/containers-if-container";
import {
  hasDisplayAssets,
  indexSheet,
  type LegacyIfsSlice,
  legacyIfsSlice,
  LegacyOverlayWriter,
  openLegacyCardWriter,
  repackDescriptorStart,
  SOURCE_DATA1_ARCHIVE,
} from "@csa/contents-display";
import { hasOverlayFileOf } from "@csa/contents-file-table";
import {
  isLegacyOverlay,
  type OverlaySplitPorts,
  PB_PACKAGE_COUNT,
  splitOverlayPackages,
  type SplitPlanPorts,
} from "@csa/contents-overlay";
import type { OpenDisc } from "@csa/core";
import {
  assertIntermediateDirectory,
  type DisplayLap as LapOf,
  type DisplayLapPorts,
  type DisplayManifest,
  fileSourcesOf,
  ifDirectoryOf,
  ifFileNameOf,
  ifFilePathOf,
  OVERLAY_PACKAGE_SECTOR_LIMIT,
  overLimitPackages,
  packageFilePath,
  planOverlaySplit,
  prepareDisplayOfLap as prepareOfLap,
} from "@csa/layout-display-prepare";
import type { ImageSetLap } from "@csa/layout-image-set";
import { elfDefinitionOf } from "@csa/selection-definitions";
import {
  forCurrentGeneration,
  indicesByGeneration,
} from "@csa/selection-manifest";
import { readImageSetLapOf } from "./image_set.ts";
import { openGeneration, openLegacyOverlay, openSongDb } from "../song/mod.ts";

/** 周回で書いた1世代分の結果 */
export type DisplayLap = LapOf<ImageSetLap>;

const places = {
  assertIntermediateDirectory,
  ifDirectoryOf,
  ifFileNameOf,
  ifFilePathOf,
};

/** 上限を超える曲中オーバーレイを分ける計算へ渡す関数 */
export const splitPlanPorts: SplitPlanPorts = {
  headerBytes: HEADER_BYTES,
  ifFileNameOf,
  ifFilePathOf,
  padToSector,
  parseAnimations,
  parseIfPackage,
  parseIfWithAnimations,
  planOverlaySplit,
  repackIfPackage,
};

const splitPorts: OverlaySplitPorts<LapDisc> = {
  ...splitPlanPorts,
  dataArchive: SOURCE_DATA1_ARCHIVE,
  fileSourcesOf,
  ifDirectoryOf,
  openSourceReader: (discsDirectory, lap) =>
    new IfRepacker(places, discsDirectory, "overlays", lap),
  overLimitPackages,
  packageFilePath,
  sectorLimit: OVERLAY_PACKAGE_SECTOR_LIMIT,
};

/** 曲DBとファイル表は世代ごとに1回だけ開く。`IFs`を持つかの判定にしか使わない */
const ifsReader = (elfOf: (generation: string) => Uint8Array) =>
  forCurrentGeneration((generation) => {
    const elf = elfOf(generation);
    return hasOverlayFileOf(
      openSongDb(generation, elf),
      elf,
      elfDefinitionOf(generation),
    );
  });

interface Types {
  disc: OpenDisc;
  elf: Uint8Array;
  ifs: LegacyIfsSlice;
  imageSet: ImageSetLap;
  repacker: IfRepacker;
}

const lapPorts: DisplayLapPorts<Types> = {
  dataArchive: SOURCE_DATA1_ARCHIVE,
  descriptorStartOf: repackDescriptorStart,
  hasDisplayAssets,
  ifsReader,
  indicesByGeneration,
  isLegacyOverlay: (generation) => isLegacyOverlay(elfDefinitionOf(generation)),
  legacyIfsSlice,
  openCardRepacker: (discsDirectory, lap) =>
    new IfRepacker(
      places,
      discsDirectory,
      "title_cards",
      lap,
      (bytes) => withSpritesAtSheetOrigin(bytes) ?? bytes,
    ),
  openLegacyCardWriter: (generation, elf, discsDirectory) =>
    openLegacyCardWriter(
      {
        openGeneration,
        packCard: packTitleCard,
        titleCardPath,
        writeTitleCard,
      },
      generation,
      elf,
      discsDirectory,
    ),
  openLegacyOverlayWriter: (discsDirectory, repacker, elfOf) =>
    new LegacyOverlayWriter(
      {
        forCurrentGeneration,
        ifDirectoryOf,
        ifFilePathOf,
        openLegacyOverlay,
        packOverlay: (images) => packLegacyOverlay(indexSheet, images),
        padToSector,
        writeIfFile,
      },
      discsDirectory,
      repacker,
      elfOf,
    ),
  openOverlayRepacker: (discsDirectory, lap) =>
    new IfRepacker(places, discsDirectory, "overlays", lap),
  packageCount: PB_PACKAGE_COUNT,
  readImageSetLap: readImageSetLapOf,
  splitOverlayPackages: (manifest, discsDirectory, lap) =>
    splitOverlayPackages(splitPorts, manifest, discsDirectory, lap),
};

/** `manifest`は、その世代の収録の候補だけを持つ。`elfOf`は世代の実行ファイルを引く */
export const prepareDisplayOfLap = (
  manifest: DisplayManifest,
  generation: string,
  disc: OpenDisc,
  directories: { discsDirectory: string; reuse: boolean },
  elfOf: (generation: string) => Uint8Array,
): Promise<DisplayLap> =>
  prepareOfLap(lapPorts, manifest, generation, disc, directories, elfOf);
