// 3rd〜8thの曲のオーバーレイをPB形式へ組み直し、manifestの参照を置いたファイルへ向ける。
// 枠は manifest を作るときに載せてあるので、ここでは`packages`だけを差し替える。

import { type DisplaySong, generatedSourceArchive } from "@csa/core";
import {
  legacyOverlayPackage,
  recordOverlayPath,
  withLegacyOverlay,
} from "../../legacy_songs.ts";
import type {
  DisplayLapPorts,
  DisplayLapTypes,
  DisplayManifest,
  ElfOf,
} from "../ports.ts";

export interface LegacyOverlayConversion<M extends DisplayManifest> {
  /** レイヤーを出すはずなのに、枠を1つも作れなかった曲の`<世代>/<曲番号>` */
  droppedKeys: Set<string>;
  manifest: M;
  /** 組み直した、または置いてあった`.if` */
  paths: string[];
}

/** 添字の小さい順に値を並べる */
const sortedValues = (map: ReadonlyMap<number, string>): string[] =>
  [...map].sort(([a], [b]) => a - b).map(([, value]) => value);

export async function convertLegacyOverlays<
  T extends DisplayLapTypes,
  M extends DisplayManifest,
>(
  ports: DisplayLapPorts<T>,
  manifest: M,
  discsDirectory: string,
  repacker: T["repacker"],
  elfOf: ElfOf<T["elf"]>,
): Promise<LegacyOverlayConversion<M>> {
  const writer = ports.openLegacyOverlayWriter(
    discsDirectory,
    repacker,
    elfOf,
  );
  const readIfs = ports.ifsReader(elfOf);
  // 処理は世代ごとにまとめるので、ファイルの並びが曲の並びのままになるよう、添字で受ける
  const droppedKeys = new Set<string>();
  const files = new Map<number, string>();
  const songs = new Array<DisplaySong>(manifest.songs.length);
  const paths = new Map<string, string>();
  // 実行ファイルは世代ごとに1回だけ読むので、世代ごとにまとめて処理する。曲の並びは変えない
  const order = ports.indicesByGeneration(
    manifest.songs,
    (song) => song.sourceGeneration,
  );
  for (const index of order) {
    const song = manifest.songs[index];
    const generation = song.sourceGeneration;
    if (!ports.isLegacyOverlay(generation)) {
      songs[index] = song;
      continue;
    }
    const source = manifest.sources[generation];
    const at = { generation, songId: song.sourceSongIndex };
    const item = legacyOverlayPackage(song);
    if (item === null) {
      const hasIfs = readIfs(generation)(song.sourceSongIndex);
      if (writer.lost(at, hasIfs)) {
        droppedKeys.add(`${generation}/${song.sourceSongIndex}`);
      }
      songs[index] = song;
      continue;
    }
    const holdFrames = song.overlay?.holdFrames;
    const built = await writer.write({
      ...at,
      ...(holdFrames === undefined ? {} : { holdFrames }),
      ifs: ports.legacyIfsSlice(item, source.elf),
    });
    if (built === null) {
      throw new Error(`${generation} ${song.title}の枠が組み立てで消えた`);
    }
    recordOverlayPath(paths, generation, item, built.path);
    files.set(index, built.path);
    songs[index] = withLegacyOverlay(song, item, {
      archive: generatedSourceArchive("file", built.path),
      size: built.size,
    });
  }
  return {
    droppedKeys,
    manifest: { ...manifest, songs },
    paths: sortedValues(files),
  };
}
