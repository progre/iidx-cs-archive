// 音声資産の変換と、音のbundleの書き出しへ、世代の規則を渡す。
// 変換とbundleの書き込み、原盤の読み出しは`@csa/contents-sound`が持つ。
// 書く音の並びは`@csa/layout-sound-bundle`が決める。

import type { Disc } from "@csa/containers-disc";
import {
  type ConvertedSound,
  convertSound as convertSoundWith,
  type SoundKind,
  writeGenerationSoundBundle as write,
} from "@csa/contents-sound";
import {
  assertDiscsDirectory,
  soundBundlePaths,
  type SoundLap,
  SoundOccurrences,
  type SoundTarget,
  soundTargetKey,
} from "@csa/layout-sound-bundle";
import {
  checkBgmForm,
  checkKeysoundForm,
  eraOf,
  keysoundRetriggerCutOf,
} from "@csa/selection-definitions";

export {
  type ConvertedSound,
  sameBytes,
  type SoundKind,
} from "@csa/contents-sound";

/** 世代ごとの音の形式の規則。`@csa/contents-sound`の変換へ渡す */
const soundRules = {
  checkBgmForm,
  checkKeysoundForm,
  eraOf,
  keysoundRetriggerCutOf,
};

export const convertSound = (
  kind: SoundKind,
  generation: string,
  bytes: Uint8Array,
): ConvertedSound => convertSoundWith(soundRules, kind, generation, bytes);

/** `onRead`は、原盤から読んだ音を変換する前に受け取る。同じ範囲の音は1度だけ渡す */
export const writeSoundBundle = (
  disc: Disc,
  generation: string,
  targets: readonly SoundTarget[],
  discsDirectory: string,
  reuse: boolean,
  onRead: (target: SoundTarget, raw: Uint8Array) => Promise<void>,
): Promise<SoundLap> =>
  write(
    {
      assertDiscsDirectory,
      kindOf: (target) => target.kind,
      keyOf: soundTargetKey,
      newOccurrences: () => new SoundOccurrences(),
      onRead,
      placeOf: ({ archiveName, asset }) => ({
        archiveName,
        offset: asset.sourceOffset,
        size: asset.sourceSize,
      }),
      rules: soundRules,
      soundBundlePaths,
    },
    disc,
    generation,
    targets,
    discsDirectory,
    reuse,
  );
