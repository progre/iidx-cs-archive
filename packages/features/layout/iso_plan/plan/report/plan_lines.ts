// ISOの計画を、実行の記録に並べる行にする。

import type { IndividualAssetManifest } from "@csa/core";
import type { PlacementPlan } from "../../types.ts";
import { describeReuse } from "../reuse.ts";
import {
  describeOverlayPlan,
  type OverlayPlanSummary,
} from "./overlay_check.ts";

/** 計画のうち、記録の行に出す部分 */
export interface PlanLinesInput {
  elfPlacement: { volumeSectors: number };
  imageSets: {
    files: readonly { summary: string }[];
    legacyIncomplete: readonly string[];
  };
  manifest: Pick<IndividualAssetManifest, "songs">;
  overlayPlan: OverlayPlanSummary;
  plan: PlacementPlan;
  prepared: { summaries: readonly string[] };
  relocations: readonly {
    fromLba: number;
    name: string;
    sectors: number;
    toLba: number;
  }[];
}

/** `songListReport`は曲・譜面一覧のHTMLのパスである */
export function planLines(
  {
    elfPlacement,
    imageSets,
    manifest,
    overlayPlan,
    plan,
    prepared,
    relocations,
  }: PlanLinesInput,
  songListReport: string,
): string[] {
  return [
    `song list: ${songListReport}`,
    ...prepared.summaries,
    `${plan.targetSongCount} slots: ${manifest.songs.length} songs / ` +
    `ABC ${plan.placements.length} (references ${plan.assets.length}) / ` +
    `title cards ${plan.data1.titleCards.length} / ` +
    `volume ${elfPlacement.volumeSectors} sectors`,
    describeOverlayPlan(overlayPlan),
    `new assets: ${plan.assetRange.startLba}..${plan.assetRange.endLba} (${
      (plan.assetRange.endLba - plan.assetRange.startLba) * 2048
    } bytes)`,
    ...describeReuse(plan),
    ...imageSets.files.map((file) => `image set ${file.summary}`),
    ...(imageSets.legacyIncomplete.length === 0 ? [] : [
      `songs with incomplete legacy slots ${imageSets.legacyIncomplete.length}: ` +
      imageSets.legacyIncomplete.join(", "),
    ]),
    ...relocations.map((relocation) =>
      `${relocation.name}: ${relocation.fromLba} -> ${relocation.toLba} (${relocation.sectors} sec)`
    ),
  ];
}
