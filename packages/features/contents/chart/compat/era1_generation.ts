// 1世代のera1の譜面を、LZファイルから展開してPB形式へ変換する手順。ファイルには書かない。
// 対象の選び方、キー音バンクの決め方、LZの読み出しは、呼び出し側が`Era1GenerationPorts`で渡す。

import type { ChartFormat } from "@csa/core";
import { decodeLz } from "../pack/mod.ts";
import { convertEra1ChartFile } from "./era1_file.ts";

/** 変換する譜面1件 */
export interface Era1ChartTarget {
  sourceFileIndex: number;
  title: string;
}

export interface Era1GenerationPorts<Target extends Era1ChartTarget> {
  /** 同じ譜面を同じキー音バンクで変換したことを確かめる。違えば例外にする */
  assertSameKeysoundBank: (
    key: string,
    converted: number,
    keysound: number,
  ) => void;
  format: ChartFormat;
  generation: string;
  /** 譜面のキー音バンク。決められなければ例外にする */
  keysoundOf: (target: Target) => number;
  /** 周回で書いたLZファイルから、譜面を1件読む */
  readLzChart: (sourceFileIndex: number) => Uint8Array;
  /** キー音バンクの旧→新`entry_id`の対応。無ければundefined */
  soundMapOf: (
    keysound: number,
  ) => Readonly<Record<string, number>> | undefined;
  /** この世代の変換対象 */
  targets: readonly Target[];
}

export interface Era1GenerationCharts {
  /** 譜面のファイルの通し番号 → 変換済みの譜面 */
  charts: Map<number, Uint8Array>;
  converted: number;
  reused: number;
}

function fail(message: string): never {
  throw new Error(message);
}

/**
 * 1世代のera1の譜面を、周回で書いたLZファイルから展開して変換する。
 * 同じ譜面を複数の曲・難易度が指すときは、同じキー音バンクで変換したことを確かめて再利用する。
 */
export function convertEra1GenerationCharts<Target extends Era1ChartTarget>(
  ports: Era1GenerationPorts<Target>,
): Era1GenerationCharts {
  const { generation } = ports;
  const charts = new Map<number, Uint8Array>();
  const keysoundOf = new Map<string, number>();
  let converted = 0;
  let reused = 0;
  for (const target of ports.targets) {
    const { sourceFileIndex, title } = target;
    const keysound = ports.keysoundOf(target);
    const key = `${generation}/${sourceFileIndex}`;
    const convertedKeysound = keysoundOf.get(key);
    if (convertedKeysound !== undefined) {
      ports.assertSameKeysoundBank(key, convertedKeysound, keysound);
      reused++;
      continue;
    }
    const map = ports.soundMapOf(keysound) ??
      fail(`${title} キー音${keysound}のsound mapが無い`);
    const chart = convertEra1ChartFile(
      decodeLz(ports.readLzChart(sourceFileIndex)),
      ports.format,
      map,
    ) ??
      fail(
        `${generation}の譜面${sourceFileIndex}のイベント列が途中で切れている`,
      );
    keysoundOf.set(key, keysound);
    charts.set(sourceFileIndex, chart);
    converted++;
  }
  return { charts, converted, reused };
}
