// manifestのera1の譜面を1世代ずつ変換し、譜面のbundleの索引を組み、位置をmanifestへ書く。
// 変換した譜面はファイルには書かない。

import type {
  ChartFormat,
  ChartLayout,
  IndividualAssetManifest,
} from "@csa/core";
import {
  convertEra1GenerationCharts,
  type Era1ChartTarget,
  type Era1GenerationCharts,
} from "../compat/mod.ts";
import {
  archiveBaseOf,
  keysoundLayoutOf,
  pickKeysound,
} from "./keysound_pick.ts";
import { type LzPlace, readLzChart } from "../lz_store/mod.ts";
import type { PackedChartIndex } from "../pack/mod.ts";
import { type PackedCharts, planPackedCharts } from "./packed_charts.ts";

/** 世代 → キー音file index → 旧→新 `entry_id` */
export type SoundMaps = ReadonlyMap<
  string,
  ReadonlyMap<number, Record<string, number>>
>;

/** 譜面の変換と配置が使う、周回で読んだ素材 */
export interface ChartSources {
  elfOf: (generation: string) => Uint8Array;
  lzOf: (generation: string) => LzPlace;
  songmapOf: (generation: string) => {
    archives: readonly string[];
    files: readonly { archive: string; index: number }[];
  };
}

/** 変換する譜面。キー音バンクを引く曲と欄を持つ */
export interface Era1SongChart extends Era1ChartTarget {
  fieldOffset: number;
  sourceSongIndex: number;
}

export interface PrepareChartsPorts {
  assertSameKeysoundBank: (
    key: string,
    converted: number,
    keysound: number,
  ) => void;
  chartFormatOf: (generation: string) => ChartFormat;
  chartSlotsOf: (generation: string) => readonly string[];
  /** 世代の曲DBの、譜面の欄の配置 */
  chartLayoutOf: (generation: string) => ChartLayout;
  chartSourceFileIndices: (
    manifest: IndividualAssetManifest,
    generation: string,
  ) => Iterable<number>;
  /** 世代のエントリーを曲番号から読む。実行ファイルは`elf`である */
  songEntryReader: (
    generation: string,
    elf: Uint8Array,
  ) => (songIndex: number) => Uint8Array;
  /** PB形式の譜面の欄の位置から、難易度名を引く */
  difficultyNameOfChartField: (fieldOffset: number) => string;
  era1ChartTargets: (
    manifest: IndividualAssetManifest,
    generation: string,
  ) => readonly Era1SongChart[];
  isEra1: (generation: string) => boolean;
  /** 譜面の位置をmanifestへ書き、その要約を返す */
  placePackedCharts: (
    manifest: IndividualAssetManifest,
    generation: string,
    index: PackedChartIndex,
  ) => string;
}

export interface PreparedPackedCharts<
  M extends IndividualAssetManifest = IndividualAssetManifest,
> {
  /** era1の譜面の変換の要約 */
  era1Summary: string;
  manifest: M;
  openImage: PackedCharts["openImage"];
  summary: string;
}

function fail(message: string): never {
  throw new Error(message);
}

/** 1世代のera1の譜面を、周回で書いたLZファイルから展開して変換する */
function convertGeneration(
  ports: PrepareChartsPorts,
  manifest: IndividualAssetManifest,
  soundMaps: SoundMaps,
  generation: string,
  sources: ChartSources,
): Era1GenerationCharts {
  const lz = sources.lzOf(generation);
  const archiveBase = archiveBaseOf(sources.songmapOf(generation));
  const entryOf = ports.songEntryReader(generation, sources.elfOf(generation));
  const keysounds = keysoundLayoutOf(
    ports.chartLayoutOf(generation),
    ports.chartSlotsOf(generation),
  );
  return convertEra1GenerationCharts({
    assertSameKeysoundBank: ports.assertSameKeysoundBank,
    format: ports.chartFormatOf(generation),
    generation,
    keysoundOf: (target) => {
      const difficulty = ports.difficultyNameOfChartField(target.fieldOffset);
      // キー音バンクは素材世代のローダーと同じく、曲DBエントリから引く
      return pickKeysound(
        entryOf(target.sourceSongIndex),
        keysounds,
        difficulty,
        archiveBase,
      ) ??
        fail(`${target.title} ${difficulty} のキー音バンクを決められない`);
    },
    readLzChart: (sourceFileIndex) => readLzChart(lz, sourceFileIndex),
    soundMapOf: (keysound) => soundMaps.get(generation)?.get(keysound),
    targets: ports.era1ChartTargets(manifest, generation),
  });
}

export function preparePackedCharts<M extends IndividualAssetManifest>(
  ports: PrepareChartsPorts,
  source: M,
  soundMaps: SoundMaps,
  sources: ChartSources,
): PreparedPackedCharts<M> {
  const charts = planPackedCharts(Object.keys(source.sources), {
    convertEra1: (generation) =>
      ports.isEra1(generation)
        ? convertGeneration(ports, source, soundMaps, generation, sources)
        : undefined,
    lzOf: sources.lzOf,
    sourceFileIndicesOf: (generation) =>
      ports.chartSourceFileIndices(source, generation),
  });
  const manifest = structuredClone(source);
  const summaries = [...charts.indices].map(([generation, index]) =>
    ports.placePackedCharts(manifest, generation, index)
  );
  return {
    era1Summary: charts.era1Summary,
    manifest,
    openImage: charts.openImage,
    summary: "PB chart bundle: " + summaries.join(" | ") +
      ` | total plain ${charts.totals.plain}B / packed ${charts.totals.packed}B`,
  };
}
