// 世代の平文の譜面を、原盤からメモリー上に作る。ファイルには書かない。

import { type ChartFormat, isProgressStep, type SongmapFile } from "@csa/core";
import { withoutFreeScratch } from "../fix/mod.ts";
import type { PlainCharts } from "./lz_store.ts";
import { decodeLz, decryptCbcCts, decryptCbcWholeBlocks } from "../pack/mod.ts";

// 譜面アーカイブの暗号鍵。実行ファイルの文字列から、1文字ずつ拾って16文字にする。
// 参考: https://github.com/SaxxonPike/iidx-ps2tools の`plugins/`の`generate_encryption_key`

/**
 * 鍵の1文字の取り方。文字列から拾う場合は、[文字列の番号, 文字列の中の位置]で表す。
 * 固定の文字は、実行ファイルの中の位置で表す。その位置のバイトが文字になる
 */
export type KeyPick = readonly [part: number, at: number] | number;

/** 実行ファイルの`offsets`にある、NULで終わるASCIIの文字列を読む */
export function readKeyParts(
  elf: Uint8Array,
  offsets: readonly number[],
): string[] {
  return offsets.map((offset) => {
    const end = elf.indexOf(0, offset);
    return String.fromCharCode(...elf.subarray(offset, end));
  });
}

export function chartKeyFrom(
  elf: Uint8Array,
  parts: readonly string[],
  picks: readonly KeyPick[],
): Uint8Array {
  return Uint8Array.from(
    picks,
    (pick) =>
      typeof pick === "number" ? elf[pick] : parts[pick[0]].charCodeAt(pick[1]),
  );
}

// 原盤に入っている譜面を平文にする。暗号がある世代は復号してから、LZを展開する。
/** `key`が無ければ、暗号が無い世代として、LZだけを展開する */
export function plainChartOf(
  raw: Uint8Array,
  key: Uint8Array | null,
): Uint8Array {
  if (key === null) {
    return decodeLz(raw);
  }
  const decrypted = raw.length % 8 === 0
    ? decryptCbcWholeBlocks(raw, key)
    : decryptCbcCts(raw, key);
  return decodeLz(decrypted);
}

export interface PlainChartPorts<Disc> {
  chartFileIndices: (files: readonly SongmapFile[]) => number[];
  chartFormatOf: (generation: string) => ChartFormat;
  /** 世代の鍵の導き方。暗号が無い世代はnull */
  chartKeyRuleOf: (generation: string) => {
    offsets: readonly number[];
    picks: readonly KeyPick[];
  } | null;
  elfFileNameOf: (generation: string) => string;
  /** 原盤の範囲を読む */
  readSegment: (disc: Disc, file: SongmapFile) => Promise<Uint8Array>;
  /** `read`で読む。実行ファイルの中の範囲なら、実行ファイルから切り出す */
  segmentOf: (
    elf: Uint8Array,
    elfName: string,
    file: SongmapFile,
    read: () => Promise<Uint8Array>,
  ) => Promise<Uint8Array>;
}

/** 譜面の暗号鍵を、世代の実行ファイルの文字列から導く。暗号が無い世代はnull */
export function chartKeyOfGeneration(
  { chartKeyRuleOf }: Pick<PlainChartPorts<unknown>, "chartKeyRuleOf">,
  generation: string,
  elf: Uint8Array,
): Uint8Array | null {
  const rule = chartKeyRuleOf(generation);
  if (rule === null) {
    return null;
  }
  return chartKeyFrom(elf, readKeyParts(elf, rule.offsets), rule.picks);
}

/** 鍵の規則が無い世代では、例外を投げる */
export function requiredChartKey(
  ports: Pick<PlainChartPorts<unknown>, "chartKeyRuleOf">,
  generation: string,
  elf: Uint8Array,
): Uint8Array {
  const key = chartKeyOfGeneration(ports, generation, elf);
  if (key === null) {
    throw new Error(`${generation}の鍵の規則が無い`);
  }
  return key;
}

/**
 * 譜面のファイルを原盤から読み、復号とLZ展開をする。
 * 3rd〜6thの譜面は実行ファイルの中にあるので、実行ファイルのバイト列から切り出す。
 * フリースクラッチは、ここで取り除く。ISOの譜面と曲リストの両方が、取り除いた譜面を使う。
 */
export async function readPlainCharts<Disc>(
  ports: PlainChartPorts<Disc>,
  generation: string,
  elf: Uint8Array,
  files: readonly SongmapFile[],
  disc: Disc,
): Promise<PlainCharts> {
  const elfName = ports.elfFileNameOf(generation);
  const key = chartKeyOfGeneration(ports, generation, elf);
  const format = ports.chartFormatOf(generation);
  const charts = new Map<number, Uint8Array>();
  const indices = ports.chartFileIndices(files);
  for (const [done, index] of indices.entries()) {
    if (isProgressStep(done + 1, indices.length)) {
      console.log(`${done + 1}/${indices.length} ${generation} chart`);
    }
    const file = files[index];
    const raw = await ports.segmentOf(
      elf,
      elfName,
      file,
      () => ports.readSegment(disc, file),
    );
    charts.set(index, withoutFreeScratch(plainChartOf(raw, key), format));
  }
  return charts;
}
