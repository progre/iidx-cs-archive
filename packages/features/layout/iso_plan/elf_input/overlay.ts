// このファイルは、CSAのELFに渡す曲DBの欄の値を決める。
// 欄は`+0x64`(読み込むパッケージの一覧)と`+0x74`(組)である。
// 値は、素材の`.if`と配置計画から求める。実際の書き込みは`buildCsaElf`が行う。
// 欄のバイト列を組むのは contents/overlay の `encodePbOverlay` である。
import {
  type ManifestOverlay,
  type ManifestOverlayPackage,
  type ManifestSong,
  overlayKey,
} from "@csa/core";
import type { PlacementPlan } from "../types.ts";

const NO_OVERLAY: ManifestOverlay = { packages: [], pairs: [] };

/** 素材の`.if`から新しいDATA1 indexを引く写像。全追加曲で1つを使い回す */
export const plannedOverlayIndices = (
  plan: PlacementPlan,
): ReadonlyMap<string, number> =>
  new Map(
    plan.data1.overlayPackages.map((item) => [
      overlayKey(item.sourceGeneration, item),
      item.newData1Index,
    ]),
  );

/** オーバーレイが無い曲は、全枠が空のオーバーレイとして扱う */
export const songOverlayOf = (song: ManifestSong): ManifestOverlay =>
  song.overlay ?? NO_OVERLAY;

/** 曲のパッケージから、配置計画のDATA1 indexを引く関数。配置に無ければ例外を投げる */
export const overlayIndexLookup = (
  song: ManifestSong,
  indices: ReadonlyMap<string, number>,
) =>
(item: ManifestOverlayPackage): number => {
  const index = indices.get(overlayKey(song.sourceGeneration, item));
  if (index === undefined) {
    throw new Error(`song${song.targetSongIndex}のオーバーレイが配置に無い`);
  }
  return index;
};
