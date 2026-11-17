// 配置計画のオーバーレイを静的に検査し、報告に出す要約を作る。
// 演奏画面の`.if`読み込み上限は未確定なので、選曲画面の上限を超える本数は数えるだけで止めない。
// 選曲画面の上限は`.if`コンテナーの知識なので、呼び出し側が引数で渡す。
import { type IndividualAssetManifest, overlayKey } from "@csa/core";
import type { PlacementPlan } from "../../types.ts";

export interface OverlayPlanSummary {
  /** 選曲画面の上限セクター数 */
  limitSectors: number;
  maxSectors: number;
  /** 選曲画面の上限を超えるパッケージ */
  overLimit: number;
  packages: number;
  songs: number;
}

export function checkOverlayPlan(
  manifest: IndividualAssetManifest,
  plan: PlacementPlan,
  limitSectors: number,
): OverlayPlanSummary {
  const placed = plan.data1.overlayPackages;
  const planned = new Map(
    placed.map((item) => [
      overlayKey(item.sourceGeneration, item),
      item.newData1Index,
    ]),
  );
  if (planned.size !== placed.length) {
    throw new Error("オーバーレイのパッケージが重複して並んでいる");
  }
  // TOCのidは採番した値をそのまま書くので、連番が崩れていないことで一致を見る
  placed.forEach((item, i) => {
    if (item.newData1Index !== placed[0].newData1Index + i) {
      throw new Error(
        `オーバーレイ${item.newData1Index}の採番が連続していない`,
      );
    }
  });
  let songs = 0;
  for (const song of manifest.songs) {
    if (song.overlay === undefined) continue;
    songs++;
    const indices = song.overlay.packages.map((item) =>
      planned.get(overlayKey(song.sourceGeneration, item)) ?? -1
    );
    if (indices.includes(-1)) {
      throw new Error(`song${song.targetSongIndex}のオーバーレイが配置に無い`);
    }
    for (const pair of song.overlay.pairs) {
      if (pair !== null && indices[pair.packageIndex] === undefined) {
        throw new Error(`song${song.targetSongIndex}の組が一覧の外を指す`);
      }
    }
  }
  const sectors = placed.map((item) => item.sectors);
  return {
    limitSectors,
    maxSectors: Math.max(0, ...sectors),
    overLimit: sectors.filter((count) => count > limitSectors).length,
    packages: placed.length,
    songs,
  };
}

export const describeOverlayPlan = (summary: OverlayPlanSummary): string =>
  `overlays: ${summary.songs} songs / packages ${summary.packages} / ` +
  `max ${summary.maxSectors} sectors / over ${summary.limitSectors}: ${summary.overLimit}`;
