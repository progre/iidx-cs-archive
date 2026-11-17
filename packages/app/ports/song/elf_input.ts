// CSAのELFを作る関数の入力を組む処理へ、配置計画と曲DBの処理を渡す。

import { openSongDb, PB_ENTRY } from "./song_db.ts";
import { pairlessSongsOf as pairlessSourceSongsOf } from "@csa/contents-display";
import {
  type CsaElfInput,
  type CsaElfInputSource,
  type SongCapacity,
  songCapacity,
  ubElfInput as input,
} from "@csa/contents-elf";
import {
  copyPbOverlayFields,
  encodePbOverlay,
  overlayLayout,
  pairlessSongsOf,
} from "@csa/contents-overlay";
import { levelFieldsWith, withoutChartFields } from "@csa/contents-song-db";
import type { IndividualAssetManifest } from "@csa/core";
import {
  assertPlanMatchesManifest,
  elfContentOf,
  elfPlacementOf,
  elfSongPartsOf,
  pairlessCandidatesOf,
  pairlessPackageLookup,
  type PlacementPlan,
  songCapacityDemand,
} from "@csa/layout-iso-plan";
import { elfDefinitionOf } from "@csa/selection-definitions";
import { mapByGeneration } from "@csa/selection-manifest";

/**
 * 曲数から決まる容量。素材を整える前のmanifestで数える。
 * 整える過程でオーバーレイは分割されうる。整えた後で数えると容量がずれる。
 */
export const ubSongCapacity = (
  manifest: IndividualAssetManifest,
  records?: number,
): SongCapacity => songCapacity({ ...songCapacityDemand(manifest), records });

export const ubElfInput = (
  source: CsaElfInputSource<PlacementPlan>,
): CsaElfInput =>
  input({
    assertPlanMatchesManifest,
    elfContentOf,
    elfPlacementOf,
    elfSongPartsOf,
    encodePbOverlay,
    entryFormat: PB_ENTRY,
    levelFieldsOf: (pbElf, songIndex, levels) =>
      levelFieldsWith(
        PB_ENTRY,
        openSongDb("pb", pbElf).bytesOf(songIndex),
        Object.entries(levels),
      ),
    pairlessSongsOf: (manifest, plan, sourceElfOf) =>
      pairlessSongsOf({
        candidates: pairlessCandidatesOf(manifest, pairlessSourceSongsOf),
        mapByGeneration,
        packageLookup: (candidate) => pairlessPackageLookup(candidate, plan),
      }, sourceElfOf),
    // 欄は2つある。パッケージの一覧(`+0x64`)と、アニメーション番号とパッケージ番号を対にした表(`+0x74`)である
    pbOverlayFieldsOf: (pbElf, songIndex) =>
      copyPbOverlayFields(
        overlayLayout(elfDefinitionOf("pb")),
        openSongDb("pb", pbElf).bytesOf(songIndex),
      ),
    withoutChartFields: (entry, excludedCharts) =>
      withoutChartFields(PB_ENTRY, entry, excludedCharts),
  }, source);
