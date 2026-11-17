// 曲1件ぶんのPB形式オーバーレイを組む。絵を焼いて、シートへ置き、場面のmetadataと合わせて`.if`にする。

import type { TileOf } from "../../legacy/mod.ts";
import {
  bakeImages,
  type OverlaySlot,
  sceneOf,
  SKIRT_CANDIDATES,
} from "../../legacy_overlay/mod.ts";
import type { LegacyOverlayWritePorts } from "./ports.ts";

export interface LegacyOverlayPackage {
  bytes: Uint8Array;
  /** 1本のパッケージが持てるsheet数に収まったか */
  fits: boolean;
  sheets: number;
}

/**
 * 隣の画素も含めて切り出すと、同じ小片を使い回せる回数が減る。
 * その結果、sheet の上限を超える曲が出る。
 * 上限を超えたら、次の候補の幅で組み直す。
 */
export function buildLegacyOverlay(
  ports: Pick<LegacyOverlayWritePorts, "packOverlay">,
  generation: string,
  elf: Uint8Array,
  tileOf: TileOf,
  slots: readonly OverlaySlot[],
): LegacyOverlayPackage {
  const attempt = (skirt: number) => {
    const baked = bakeImages(generation, elf, tileOf, slots, skirt);
    return { baked, packed: ports.packOverlay(baked.images) };
  };
  let last = attempt(SKIRT_CANDIDATES[0]);
  for (const skirt of SKIRT_CANDIDATES.slice(1)) {
    if (last.packed.fits) {
      break;
    }
    last = attempt(skirt);
  }
  const { baked, packed } = last;
  const scenes = slots.map((slot) => sceneOf(slot, baked.placed, baked.skirt));
  return {
    bytes: packed.packageOf(scenes),
    fits: packed.fits,
    sheets: packed.sheets,
  };
}
