// 曲リストに容量を表示するオーバーレイの`.if`について、原盤上の位置を求める。
// 位置は、曲リストと同じく素材の曲DBとファイル表から引く。
// 下書きのオーバーレイは使わない。枠を1つも使わない曲では、下書きがオーバーレイを持たないからである。

import { SEC, type SourceSlice } from "@csa/core";
import type { LapMeasurePorts } from "../../ports.ts";

/** 曲番号ごとの`.if`。`sourceFileIndex`は、曲リストの識別子に使う番号である */
export function overlaySlicesOf(
  ports: LapMeasurePorts,
  generation: string,
  elf: Uint8Array,
  songIds: Iterable<number>,
): SourceSlice[] {
  if (ports.isLegacyOverlay(generation)) {
    const fileOf = ports.legacyOverlayFiles(generation, elf);
    return [...songIds].flatMap((songId) => {
      const file = fileOf(songId);
      return file === null ? [] : [{
        sourceArchive: file.entry.archive,
        sourceFileIndex: file.serial,
        sourceOffset: file.entry.offset,
        sourceSize: file.entry.size,
      }];
    });
  }
  const tocFileOffset = ports.sourceTocFileOffset(generation);
  return [...songIds].flatMap((songId) =>
    ports.overlayPackagesOf(generation, elf, songId).map((index) => {
      const row = ports.tocRowOf(elf, tocFileOffset, index);
      return {
        sourceArchive: ports.dataArchive,
        sourceFileIndex: index,
        sourceOffset: row.sector * SEC,
        sourceSize: row.count * SEC,
      };
    })
  );
}
