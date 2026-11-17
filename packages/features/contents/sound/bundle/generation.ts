// 1世代の音のbundleを、世代のフォルダーへ書く。

import type { OpenDisc } from "@csa/core";
import { makeDirectory } from "./bundle_gateway.ts";
import type { SoundBundlePorts } from "./ports.ts";
import {
  type SoundBundlePaths,
  writeSoundBundle,
  type WrittenSoundBundle,
} from "./write.ts";

export interface GenerationBundlePorts<T, O> extends SoundBundlePorts<T, O> {
  assertDiscsDirectory: (discsDirectory: string) => void;
  soundBundlePaths: (
    discsDirectory: string,
    generation: string,
  ) => SoundBundlePaths;
}

export async function writeGenerationSoundBundle<T, O>(
  ports: GenerationBundlePorts<T, O>,
  disc: OpenDisc,
  generation: string,
  targets: readonly T[],
  discsDirectory: string,
  reuse: boolean,
): Promise<WrittenSoundBundle<O> & { generation: string }> {
  ports.assertDiscsDirectory(discsDirectory);
  makeDirectory(`${discsDirectory}/${generation}`);
  const written = await writeSoundBundle(
    ports,
    disc,
    generation,
    targets,
    ports.soundBundlePaths(discsDirectory, generation),
    reuse,
  );
  return { ...written, generation };
}
