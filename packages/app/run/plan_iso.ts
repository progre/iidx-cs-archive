// 原盤のELFと収録内容から、CSAのELFと配置計画を作る。ISOは書かない。
// 作ったELFは、ここで`intermediate/iso/`の中間ファイルとして書く。配置計画のレポートは`--write-plan`を付けたときだけ書く。

import { buildImageSets } from "../ports/display/mod.ts";
import { pbChartKey } from "../ports/media/mod.ts";
import { ubElfInput, ubSongCapacity } from "../ports/song/mod.ts";
import {
  buildCsaElf,
  placeCsaElf,
  readElfPatchTables,
} from "@csa/contents-elf";
import type { IndividualAssetManifest } from "@csa/core";
import { elfFileNameOf } from "@csa/selection-definitions";
import { SELECT_SCREEN_LIMIT_SECTORS } from "@csa/containers-if-container";
import {
  checkOverlayPlan,
  createPlacementPlan,
  freedRangesOf,
  type OverlayPlanSummary,
  planReportTsv,
  validateSourceSlices,
  writePlanReport,
} from "@csa/layout-iso-plan";
import type { SongListRun } from "@csa/report-song-list";
import { readImageInfo, readSourceElf } from "@csa/containers-disc";
import type { LapInputs } from "./prepare_assets.ts";
import { writeSongListOf } from "./song_list_writer.ts";
import type { PreparedAssets } from "./prepare_assets.ts";

export interface Run extends SongListRun {
  /** ISOを2つの枠へ交互に書く。開発者向けの設定 */
  slot: boolean;
  /** 曲リストのHTMLとJSONだけを書き、ISOの計画と書き込みをしない */
  songListOnly: boolean;
  /**
   * ISOを書いた後に読み戻して確かめる。
   * 中間ファイルから写した部分は、中間ファイルと比べる。
   * PBから写した部分は、PBの原盤と比べる
   */
  verify: boolean;
  /** 配置計画のTSVを`PLAN_REPORT`へ書く */
  writePlan: boolean;
}

export interface IsoPlan extends ReturnType<typeof placeCsaElf> {
  /** 譜面をISOの書き込みのときに暗号化する、PBの鍵 */
  chartKey: Uint8Array;
  image: Awaited<ReturnType<typeof readImageInfo>>;
  imageSets: Awaited<ReturnType<typeof buildImageSets>>;
  manifest: IndividualAssetManifest;
  overlayPlan: OverlayPlanSummary;
  plan: ReturnType<typeof createPlacementPlan>;
  prepared: PreparedAssets;
}

export async function planIso(
  { full, removed, sourceManifest, writePlan }: Run,
  laps: LapInputs,
): Promise<IsoPlan> {
  validateSourceSlices(sourceManifest, laps.discs);
  const pbElfName = elfFileNameOf("pb");
  const image = await readImageInfo(laps.pb, pbElfName);
  const pbElf = await readSourceElf(laps.pb, image.elf);
  const chartKey = pbChartKey(pbElf);
  const { sources } = laps.songs;
  const prepared = await writeSongListOf(
    { full, removed, sourceManifest },
    laps,
  );
  const manifest = prepared.manifest;
  // 容量は、prepareAssetsを呼ぶ前のmanifestで数える。prepareAssetsの後は、オーバーレイの本数が変わる
  const capacity = ubSongCapacity(sourceManifest);
  const imageSets = await buildImageSets({
    lapOf: (generation) => laps.displayLaps.get(generation)?.imageSet,
    manifest,
    pb: laps.pb,
    pbData1Lba: image.data1.lba,
    pbElf,
  });
  const plan = createPlacementPlan(manifest, {
    abcCapacity: capacity.abcCapacity,
    data1BaseLba: image.data1.lba,
    imageSetFiles: imageSets.files,
    reusableRanges: freedRangesOf(laps.pb.info.files, manifest.freedPbFiles),
    sourceVolumeSectors: image.volumeSectors,
  });
  // 上限は`.if`コンテナーの知識なので、配置計画ではなくここで渡す
  const overlayPlan = checkOverlayPlan(
    manifest,
    plan,
    SELECT_SCREEN_LIMIT_SECTORS,
  );
  const built = buildCsaElf(
    pbElf,
    ubElfInput({
      capacity,
      folderNames: imageSets.folderNames,
      manifest,
      plan,
      songSprites: imageSets.songSprites,
      sourceElfOf: sources.elfOf,
    }),
    readElfPatchTables(),
  );
  const placed = placeCsaElf(built, plan, image, pbElfName);
  if (writePlan) {
    writePlanReport(planReportTsv(plan, manifest));
  }
  return {
    ...placed,
    chartKey,
    image,
    imageSets,
    manifest,
    overlayPlan,
    plan,
    prepared,
  };
}
