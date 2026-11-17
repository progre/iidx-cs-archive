// 世代の周回で、曲リストに使う音とオーバーレイの長さとハッシュを原盤から求める。

import type { ManifestSongDraft, OpenDisc, SoundPrint } from "@csa/core";
import type { LapMeasurePorts } from "../../ports.ts";
import { overlaySlicesOf } from "./overlay_slices.ts";
import { overlayPrintsOf, soundPrintsOf } from "./prints.ts";
import { sourceLengthsOf } from "./source_lengths.ts";

export interface LapMeasures {
  /** `overlaySourceOf`の識別子 → オーバーレイの中身のハッシュ。全曲リストで外した行の分も持つ */
  contentPrints: Map<string, string>;
  /** 素材側の識別子 → 音の本体とヘッダーのハッシュ。全曲リストで外した行の分も持つ */
  soundPrints: Map<string, SoundPrint>;
  /** 素材側の識別子 → 音とオーバーレイの、末尾のゼロを除いた長さ。全曲リストで外した行の分も持つ */
  sourceLengths: Map<string, number>;
}

/**
 * `songIds`は、世代の各行の曲番号である。`songs`は、下書きの欄を埋めた行である。
 * `knownSoundPrints`は、音のbundleを書くときに求めた音のハッシュである
 */
export async function measureLap(
  ports: LapMeasurePorts,
  opened: OpenDisc,
  generation: string,
  elf: Uint8Array,
  songIds: Iterable<number>,
  songs: readonly ManifestSongDraft[],
  knownSoundPrints: ReadonlyMap<string, SoundPrint>,
): Promise<LapMeasures> {
  console.time(`time ${generation} sound and overlay lengths`);
  const overlays = overlaySlicesOf(ports, generation, elf, songIds);
  const sourceLengths = await sourceLengthsOf(
    ports,
    opened,
    generation,
    songs,
    overlays,
  );
  console.timeEnd(`time ${generation} sound and overlay lengths`);
  console.time(`time ${generation} sound and overlay hashes`);
  const soundPrints = await soundPrintsOf(
    ports,
    opened,
    generation,
    songs,
    knownSoundPrints,
  );
  const contentPrints = await overlayPrintsOf(
    ports,
    opened,
    generation,
    overlays,
    sourceLengths,
  );
  console.timeEnd(`time ${generation} sound and overlay hashes`);
  return { contentPrints, soundPrints, sourceLengths };
}
