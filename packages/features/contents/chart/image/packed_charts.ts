// 素材世代の譜面をPB鍵で暗号化したbundleの、索引を組む。暗号化はここでは行わない。
// 暗号化は、ISOの書き込みと照合のときに行う。`openImage`が返す`DiscImage`を読むと、譜面を1件ずつ暗号化する。
// 譜面の長さは、世代によって求め方が違う。
// - era1以外: 周回で書いたLZファイルの長さ
// - era1: 変換した譜面をLZにした長さ

import type { DiscImage } from "@csa/core";
import {
  encodeLz,
  type PackedChartIndex,
  planPackedChartIndex,
} from "../pack/mod.ts";
import { lzChartSizes, readLzChart } from "../lz_store/mod.ts";
import { PackedChartImage } from "./packed_chart_image.ts";
import type { PackedChartPorts } from "./ports.ts";

export interface PackedCharts {
  /** era1の譜面の変換の要約 */
  era1Summary: string;
  /** 世代 → bundleの索引 */
  indices: ReadonlyMap<string, PackedChartIndex>;
  /**
   * 世代のbundleを、読むたびにPB鍵で暗号化する`DiscImage`として返す。
   * 読む範囲に重なる譜面だけを、1件ずつ暗号化する。
   */
  openImage: (generation: string, chartKey: Uint8Array) => DiscImage;
  /** 全世代の平文の合計と、bundleの合計の大きさ */
  totals: { packed: number; plain: number };
}

/** 世代のbundleの索引と、変換したera1の譜面のLZ(era1以外は`undefined`) */
interface GenerationCharts {
  /** 通し番号 → 変換したera1の譜面のLZ。変換は周回のLZファイルを書き換えないので、ISOの書き込みまでメモリーに持つ */
  era1Lz: ReadonlyMap<number, Uint8Array> | undefined;
  index: PackedChartIndex;
}

function fail(message: string): never {
  throw new Error(message);
}

/**
 * 1作品ぶんの譜面のbundleの索引を作る。譜面は、source file indexの昇順に並べる。
 * era1の世代では、`era1`に変換済みの譜面を渡す
 */
function planGenerationCharts(
  generation: string,
  era1: ReadonlyMap<number, Uint8Array> | undefined,
  ports: PackedChartPorts,
): GenerationCharts {
  const sourceFileIndices = [...ports.sourceFileIndicesOf(generation)]
    .sort((a, b) => a - b);
  if (era1 === undefined) {
    return {
      era1Lz: undefined,
      index: planPackedChartIndex(
        lzChartSizes(ports.lzOf(generation), sourceFileIndices),
      ),
    };
  }
  const charts = sourceFileIndices.map((sourceFileIndex) => {
    const plain = era1.get(sourceFileIndex) ??
      fail(`${generation}の変換済み譜面${sourceFileIndex}が無い`);
    return { lz: encodeLz(plain), plainSize: plain.length, sourceFileIndex };
  });
  return {
    era1Lz: new Map(
      charts.map(({ lz, sourceFileIndex }) => [sourceFileIndex, lz]),
    ),
    index: planPackedChartIndex(
      charts.map(({ lz, plainSize, sourceFileIndex }) => ({
        plainSize,
        size: lz.length,
        sourceFileIndex,
      })),
    ),
  };
}

export function planPackedCharts(
  generations: readonly string[],
  ports: PackedChartPorts,
): PackedCharts {
  const planned = new Map<string, GenerationCharts>();
  let converted = 0;
  let reused = 0;
  for (const generation of generations) {
    // era1の譜面は、どの世代でも変換する。キー音バンクの検査を、変換の中で行うためである。
    // 変換は1世代ずつ行い、変換した平文の譜面は次の世代へ持ち越さない。
    const era1 = ports.convertEra1(generation);
    converted += era1?.converted ?? 0;
    reused += era1?.reused ?? 0;
    planned.set(
      generation,
      planGenerationCharts(generation, era1?.charts, ports),
    );
  }
  const indices = new Map(
    [...planned].map(([generation, { index }]) => [generation, index]),
  );
  return {
    era1Summary: `era1 charts: converted ${converted} / reused ${reused}`,
    indices,
    openImage: (generation, chartKey) => {
      const { era1Lz, index } = planned.get(generation) ??
        fail(`${generation}の譜面bundleが配置されていない`);
      return new PackedChartImage(
        index,
        (sourceFileIndex) =>
          era1Lz?.get(sourceFileIndex) ??
            readLzChart(ports.lzOf(generation), sourceFileIndex),
        chartKey,
      );
    },
    totals: {
      packed: [...indices.values()].reduce((s, i) => s + i.bundleBytes, 0),
      plain: [...indices.values()].reduce((s, i) => s + i.plainBytes, 0),
    },
  };
}
