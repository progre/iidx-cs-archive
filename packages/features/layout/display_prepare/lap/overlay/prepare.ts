// 曲中オーバーレイを演奏画面が読める形へ整える。記述子が`+4`の世代(9th〜red・US)は
// PBのloaderが読む`+8`形式へ並べ替え、3rd〜8thはELFの4段表からPB形式へ組み直す。
// 読み込み領域に収まらない`.if`は場面ごとに分ける。
// どれも単体ファイルとして置き、manifestの参照をそのファイルへ差し替える。周回の中で呼ぶ。
import {
  type DisplaySong,
  generatedSourceArchive,
  isProgressStep,
} from "@csa/core";
import { overlayRepackRequests, withRepackedOverlay } from "../../repack.ts";
import { rewriteOverlayPackages } from "../../split/mod.ts";
import type {
  DisplayLapPorts,
  DisplayLapTypes,
  DisplayManifest,
  ElfOf,
  LapDisc,
} from "../ports.ts";
import { convertLegacyOverlays } from "./legacy.ts";

export interface PreparedOverlays<M extends DisplayManifest> {
  /** レイヤーを出すはずなのに、枠を1つも作れなかった曲の`<世代>/<曲番号>` */
  droppedKeys: Set<string>;
  /** 置いた`.if`。上限を超えて分けたオーバーレイは、分けた後の`.if`も入れる */
  files: string[];
  manifest: M;
  /** 分ける前の曲。並びは`manifest.songs`と同じである */
  repackedSongs: readonly DisplaySong[];
}

/**
 * `<discsDirectory>/<世代>/overlays/NNNN.if`へ書く。複数の曲が同じパッケージを指すので、
 * 2曲目以降は、この回に書いたファイルの大きさを使う。
 */
async function repackOverlays<
  T extends DisplayLapTypes,
  M extends DisplayManifest,
>(
  ports: DisplayLapPorts<T>,
  manifest: M,
  discsDirectory: string,
  elfOf: ElfOf<T["elf"]>,
  lap: LapDisc<T["disc"]>,
) {
  const repacker = ports.openOverlayRepacker(discsDirectory, lap);
  try {
    const legacy = await convertLegacyOverlays(
      ports,
      manifest,
      discsDirectory,
      repacker,
      elfOf,
    );
    const songs: DisplaySong[] = [];
    const total = legacy.manifest.songs.length;
    for (const [count, song] of legacy.manifest.songs.entries()) {
      if (isProgressStep(count + 1, total)) {
        console.log(`${count + 1}/${total} ${lap.generation} overlay`);
      }
      const requests = overlayRepackRequests(song, ports);
      if (requests === null) {
        songs.push(song);
        continue;
      }
      const files = [];
      for (const request of requests) {
        const done = await repacker.repack(request);
        files.push({
          archive: generatedSourceArchive("file", done.path),
          size: done.size,
        });
      }
      songs.push(withRepackedOverlay(song, files));
    }
    return {
      files: [...repacker.paths(), ...legacy.paths],
      legacy,
      manifest: { ...legacy.manifest, songs },
    };
  } finally {
    repacker.close();
  }
}

export async function prepareOverlays<
  T extends DisplayLapTypes,
  M extends DisplayManifest,
>(
  ports: DisplayLapPorts<T>,
  manifest: M,
  discsDirectory: string,
  elfOf: ElfOf<T["elf"]>,
  lap: LapDisc<T["disc"]>,
): Promise<PreparedOverlays<M>> {
  const repacked = await repackOverlays(
    ports,
    manifest,
    discsDirectory,
    elfOf,
    lap,
  );
  const split = await ports.splitOverlayPackages(
    repacked.manifest,
    discsDirectory,
    lap,
  );
  return {
    droppedKeys: repacked.legacy.droppedKeys,
    files: [...repacked.files, ...split.files],
    manifest: rewriteOverlayPackages(
      repacked.manifest,
      split.parts,
      ports.packageCount,
    ),
    repackedSongs: repacked.manifest.songs,
  };
}
