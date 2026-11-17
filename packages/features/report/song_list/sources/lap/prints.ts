// 世代の音とオーバーレイのハッシュを原盤から求める。曲リストは、これで同じファイルかどうかを見分ける。
// 長さと同じく、全曲リストで外した行の分も求める。ファイルは1本ずつ読み切る。

import {
  isProgressStep,
  type ManifestSongDraft,
  type OpenDisc,
  SEC,
  type SoundPrint,
  type SourceSlice,
} from "@csa/core";
import { overlaySourceOf, soundSourceOf } from "../../data/rows/mod.ts";
import type { LapMeasurePorts } from "../../ports.ts";

/** 識別子`世代:file index` → 音のハッシュ。`known`にある音は、原盤から読まない */
export async function soundPrintsOf(
  ports: LapMeasurePorts,
  { disc, files }: OpenDisc,
  generation: string,
  songs: Iterable<ManifestSongDraft>,
  known: ReadonlyMap<string, SoundPrint>,
): Promise<Map<string, SoundPrint>> {
  const prints = new Map(known);
  const assets = [...songs].flatMap((song) => song.assets ?? []);
  for (const [done, asset] of assets.entries()) {
    if (isProgressStep(done + 1, assets.length)) {
      console.log(`${done + 1}/${assets.length} ${generation} sound print`);
    }
    const source = soundSourceOf(generation, asset.sourceFileIndex);
    if (
      (asset.kind !== "bgm" && asset.kind !== "keysound") || prints.has(source)
    ) {
      continue;
    }
    const archiveName = asset.sourceArchive.toUpperCase().split(";")[0];
    const archive = files.get(archiveName);
    if (archive === undefined) {
      throw new Error(`source ISOに${archiveName}が無い`);
    }
    const bytes = await disc.readAt(
      archive.lba * SEC + asset.sourceOffset,
      asset.sourceSize,
    );
    prints.set(source, await ports.soundPrint(asset.kind, bytes));
  }
  return prints;
}

/**
 * `overlaySourceOf`の識別子 → オーバーレイの中身のハッシュ。範囲は`lengths`の長さまでとする。
 * `.if`の記述子が示す長さが目次の大きさを超える原盤があるので、目次の大きさで抑える
 */
export async function overlayPrintsOf(
  ports: LapMeasurePorts,
  { disc, files }: OpenDisc,
  generation: string,
  overlays: readonly SourceSlice[],
  lengths: ReadonlyMap<string, number>,
): Promise<Map<string, string>> {
  const prints = new Map<string, string>();
  for (const [done, slice] of overlays.entries()) {
    if (isProgressStep(done + 1, overlays.length)) {
      console.log(`${done + 1}/${overlays.length} ${generation} overlay print`);
    }
    const source = overlaySourceOf(generation, slice.sourceFileIndex);
    const length = lengths.get(source);
    const archive = files.get(slice.sourceArchive.toUpperCase().split(";")[0]);
    if (length === undefined || archive === undefined || prints.has(source)) {
      continue;
    }
    const bytes = await disc.readAt(
      archive.lba * SEC + slice.sourceOffset,
      Math.min(length, slice.sourceSize),
    );
    prints.set(source, await ports.printOf(bytes));
  }
  return prints;
}
