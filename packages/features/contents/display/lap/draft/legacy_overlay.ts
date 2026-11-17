// 3rd〜8thの曲中オーバーレイを、ELFの4段表から読んでmanifest形式にする。

import type { ManifestOverlay, ManifestSongDraft } from "@csa/core";
import {
  elfTileArchive,
  hasHoldFrame,
  overlayPairs,
} from "../../legacy_overlay/mod.ts";
import type { DraftOverlayPorts, DraftSource } from "./ports.ts";

/** 1分は3600 frame(1/60秒) */
const FRAMES_PER_MINUTE = 3600;
/** BPMが変わらない曲では、曲DBエントリの最大BPMの欄が0xFFFFになる */
const NO_BPM_RANGE = 0xffff;

/** 曲DBエントリのBPM欄。値は譜面から求めてある */
export interface EntryBpm {
  max: number;
  min: number;
}

export function legacyOverlay(
  ports: Pick<DraftOverlayPorts, "legacyOverlayOf">,
  row: ManifestSongDraft,
  source: DraftSource,
  bpm: EntryBpm,
): ManifestOverlay | undefined {
  const { filesOf, slots: legacy } = source.legacy ??
    fail(`${row.sourceGeneration}はlegacyのオーバーレイを持たない`);
  const slots = legacy.songOf(row.sourceSongIndex).slots;
  const overlay = ports.legacyOverlayOf(
    overlayPairs(slots, legacy.slotCount),
    () => {
      const file = filesOf(row.sourceSongIndex);
      return file === null ? null : {
        archive: file.entry.archive,
        offset: file.entry.offset,
        serial: file.serial,
        size: file.entry.size,
      };
    },
    () => ({
      animation: slots[0].animation,
      archive: elfTileArchive(source.manifest.elf, slots),
    }),
  );
  if (overlay === undefined || !hasHoldFrame(slots)) {
    return overlay;
  }
  // 1拍の長さにする。BPMが変わる曲では、どのBPMの拍にするかが決まっていない
  if (bpm.max !== NO_BPM_RANGE) {
    throw new Error(
      `${row.sourceGeneration} ${row.title}: BPMが変わる曲の表示長255の frame は、縮める長さが決まっていない`,
    );
  }
  return {
    ...overlay,
    holdFrames: Math.round(FRAMES_PER_MINUTE / bpm.min),
  };
}

function fail(message: string): never {
  throw new Error(message);
}
