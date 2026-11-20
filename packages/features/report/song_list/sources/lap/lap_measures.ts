// 世代の周回で、曲リストに使う音とオーバーレイの長さとハッシュを原盤から求める。

import type { ManifestSongDraft, OpenDisc, SoundPrint } from "@csa/core";
import type { LapMeasurePorts } from "../../ports.ts";
import { overlayMeasuresOf } from "./overlay_measures.ts";
import { overlaySlicesOf } from "./overlay_slices.ts";
import { type SoundMeasures, soundMeasuresOf } from "./sound_measures.ts";

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
 * `knownSounds`は、音のbundleを書くときに読んだ音から求めたハッシュと長さである
 */
export async function measureLap(
  ports: LapMeasurePorts,
  opened: OpenDisc,
  generation: string,
  elf: Uint8Array,
  songIds: Iterable<number>,
  songs: readonly ManifestSongDraft[],
  knownSounds: SoundMeasures,
): Promise<LapMeasures> {
  console.time(`time ${generation} sound and overlay hashes`);
  const sounds = await soundMeasuresOf(
    ports,
    opened,
    generation,
    songs,
    knownSounds,
  );
  const overlays = await overlayMeasuresOf(
    ports,
    opened,
    generation,
    overlaySlicesOf(ports, generation, elf, songIds),
  );
  console.timeEnd(`time ${generation} sound and overlay hashes`);
  return {
    contentPrints: overlays.prints,
    soundPrints: sounds.prints,
    sourceLengths: new Map([...sounds.lengths, ...overlays.lengths]),
  };
}
