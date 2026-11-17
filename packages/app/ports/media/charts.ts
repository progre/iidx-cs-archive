// 平文の譜面と譜面のbundleの処理へ、世代の決まりと曲DBと原盤の読み出しを渡す。

import { type Disc, readSegment } from "@csa/containers-disc";
import {
  type ChartSources,
  type PlainChartPorts,
  type PreparedPackedCharts,
  preparePackedCharts as prepare,
  readPlainCharts as read,
  requiredChartKey,
  type SoundMaps,
} from "@csa/contents-chart";
import { segmentOf } from "@csa/contents-file-table";
import type { IndividualAssetManifest, SongmapFile } from "@csa/core";
import {
  chartSourceFileIndices,
  placePackedCharts,
} from "@csa/layout-chart-bundle";
import {
  chartFileIndices,
  chartFormatOf,
  chartKeyRuleOf,
  chartSlotsOf,
  elfDefinitionOf,
  elfFileNameOf,
  eraOf,
} from "@csa/selection-definitions";
import {
  assertSameKeysoundBank,
  era1ChartTargets,
} from "@csa/selection-manifest";
import { openSongDb, PB_ENTRY } from "../song/mod.ts";

export type { PreparedPackedCharts };

const plainPorts: PlainChartPorts<Disc> = {
  chartFileIndices,
  chartFormatOf,
  chartKeyRuleOf,
  elfFileNameOf,
  readSegment,
  segmentOf,
};

export const readPlainCharts = (
  generation: string,
  elf: Uint8Array,
  files: readonly SongmapFile[],
  disc: Disc,
) => read(plainPorts, generation, elf, files, disc);

/** 再暗号化に使うPBの鍵。PBの実行ファイルから導く */
export const pbChartKey = (pbElf: Uint8Array): Uint8Array =>
  requiredChartKey(plainPorts, "pb", pbElf);

export const preparePackedCharts = <M extends IndividualAssetManifest>(
  source: M,
  soundMaps: SoundMaps,
  sources: ChartSources,
): PreparedPackedCharts<M> =>
  prepare(
    {
      assertSameKeysoundBank,
      chartFormatOf,
      chartLayoutOf: (generation) =>
        elfDefinitionOf(generation).songDbRecordLayout.chart,
      chartSlotsOf,
      chartSourceFileIndices,
      difficultyNameOfChartField: (fieldOffset) =>
        PB_ENTRY.difficultyNameOfChartField(fieldOffset),
      era1ChartTargets,
      isEra1: (generation) => eraOf(generation) === "era1",
      placePackedCharts,
      songEntryReader: (generation, elf) => {
        const songDb = openSongDb(generation, elf);
        return (songIndex) => songDb.bytesOf(songIndex);
      },
    },
    source,
    soundMaps,
    sources,
  );
