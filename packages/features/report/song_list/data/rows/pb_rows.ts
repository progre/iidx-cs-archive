// PB収録曲の行。譜面の有無と容量はsongmap、題名とレベルは原盤の曲DBから採る。

import type { ManifestPbBack } from "@csa/core";
import type { RowPorts } from "../../ports.ts";
import type { Video } from "../../types.ts";
import type { ListedPbSong } from "../input.ts";
import {
  chartsOf,
  folderFieldsOf,
  type FrontFill,
  overlayOf,
  type SortedRow,
  splitMoves,
} from "./row_fields.ts";
import { type BytesOf, pbSize } from "../sizes.ts";

/** `redirects`は、song_idからムービーの差し替え先を引く表 */
export function pbRowsOf(
  ports: RowPorts,
  pbSongs: readonly ListedPbSong[],
  redirects: ReadonlyMap<number, Video>,
  bytesOf: BytesOf,
): SortedRow[] {
  return pbSongs
    .filter(({ song }) => Object.keys(song.charts).length > 0)
    .map(({ chartPrints, key, overlay, shown, song }) => ({
      row: {
        ...pbSize(song, redirects.get(song.song_id), bytesOf),
        charts: chartsOf(
          shown,
          chartPrints,
          (name) => song.charts[name] !== undefined,
        ),
        ...folderFieldsOf(ports.folderShort, shown.folder, shown),
        generation: "pb",
        inSelectList: true,
        key,
        note: undefined,
        original: true,
        ...overlayOf("pb", overlay, bytesOf),
        removed: false,
        // PB収録曲の曲indexは、原盤のsong_idのままである
        saveIndex: song.song_id,
        songId: song.song_id,
        // PB収録曲は原盤そのものなので、原作の枠と収録フォルダーは同じ値になる
        sourceFolder: ports.folderShort(shown.folder),
        title: song.title,
      },
      catalogKey: ports.catalogKeyOf("pb", song.song_id),
      sortKey: shown.sortKey,
    }));
}

interface PbBackFront {
  canonicalKey: string;
  sourceGeneration: string;
  sourceSongIndex: number;
  targetSongIndex: number;
}

/**
 * 表を PB 以外の版にした組では、PB原盤の曲の行を、PBの枠に置いた表の曲の裏の行にする。
 * 裏の行は選曲リストに並ばず、セーブの枠も持たない。
 * 写しの裏から表の曲へ出す譜面は、表の曲の行に足す譜面として返す
 */
export function withPbBacks(
  rows: readonly SortedRow[],
  backs: readonly ManifestPbBack[],
  fronts: readonly PbBackFront[],
): { frontFills: FrontFill[]; rows: SortedRow[] } {
  const backOf = new Map(backs.map((back) => [back.songId, back]));
  const frontAt = new Map(fronts.map((song) => [song.targetSongIndex, song]));
  const frontFills: FrontFill[] = [];
  const result = rows.map((sorted): SortedRow => {
    const back = backOf.get(sorted.row.songId);
    const front = back === undefined ? undefined : frontAt.get(back.songId);
    if (back === undefined || front === undefined) {
      return sorted;
    }
    for (const [name, from] of splitMoves(back).fills) {
      const chart = sorted.row.charts[from];
      if (chart !== undefined) {
        frontFills.push({
          chart: { ...chart, from: { chart: from, generation: "pb" } },
          name,
          saveIndex: back.songId,
        });
      }
    }
    const { saveIndex: _, ...row } = sorted.row;
    return {
      ...sorted,
      row: {
        ...row,
        inSelectList: false,
        variantFor: {
          front: front.canonicalKey,
          frontGeneration: front.sourceGeneration,
          frontIndex: back.songId,
          frontSongId: front.sourceSongIndex,
          position: back.position,
          rule: "custom",
        },
      },
    };
  });
  return { frontFills, rows: result };
}
