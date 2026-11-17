// CSAから外した曲の行。外した曲でも、資産の識別子とバイト数を見せる。
// 資産は、収録するときに置くものと同じである。CSAには置かないので、ABC indexは持たない。

import type { RowPorts } from "../../ports.ts";
import type { ListedExcludedSong } from "../input.ts";
import {
  chartsOf,
  folderFieldsOf,
  folderTextOf,
  hasNotes,
  overlayOf,
  type SortedRow,
} from "./row_fields.ts";
import { type BytesOf, songSize } from "../sizes.ts";

export function excludedRowOf(
  ports: RowPorts,
  song: ListedExcludedSong,
  sharedAbcIndex: number,
  bytesOf: BytesOf,
): SortedRow {
  const { shown, sourceGeneration: generation } = song;
  const sourceFolder = ports.sourceFolderOf(generation, song);
  // 外した曲のエントリにも、収録する曲と同じ規則で作品番号を書いてある
  const folder = shown.folder;
  return {
    row: {
      // 流用するムービーは、収録するときに決まる。外した曲は決まらないので、曲DBのムービー欄は見ない
      ...songSize(
        {
          assets: song.assets,
          sourceGeneration: generation,
          videoFields: song.videoFields,
        },
        [],
        undefined,
        sharedAbcIndex,
        bytesOf,
      ),
      charts: chartsOf(
        shown,
        song.chartPrints,
        hasNotes(shown),
        song.excludedCharts,
      ),
      ...folderFieldsOf(ports.folderShort, folder, shown),
      generation,
      inSelectList: false,
      key: song.canonicalKey,
      note: song.note,
      original: false,
      ...overlayOf(generation, song.sourceOverlay, bytesOf),
      removed: true,
      songId: song.sourceSongIndex,
      sourceFolder: folderTextOf(ports.folderShort, sourceFolder),
      title: song.title,
    },
    catalogKey: ports.catalogKeyOf(
      generation,
      song.sourceSongIndex,
      song.catalogLine,
    ),
    sortKey: shown.sortKey,
  };
}
