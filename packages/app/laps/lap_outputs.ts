// 世代の周回で、曲の素材を書き出す。音のbundleと、写す映像、曲名カード・オーバーレイの`.if`である。
// 書き出すのは、その世代で収録する行である。
// 行は、manifestに載るのと同じ順に並べる。
// 周回の後にmanifestを仕上げるため、下書きを埋めた行と、全曲リストの行も返す。

import { lapDisplayManifest } from "@csa/layout-display-prepare";
import type { DisplaySong, ManifestSongDraft, SoundPrint } from "@csa/core";
import { draftedLapRows } from "@csa/selection-manifest";
import { type DisplayLap, prepareDisplayOfLap } from "../ports/display/mod.ts";
import { type SoundLap, soundTargetsOfSongs } from "@csa/layout-sound-bundle";
import { writeSoundBundle } from "../ports/media/mod.ts";
import { soundPrint } from "@csa/contents-sound";
import { soundSourceOf } from "@csa/report-song-list";
import { type CopyLap, writeCopiedVideos } from "@csa/contents-video";
import type { Disc } from "@csa/containers-disc";
import type { CatalogRow } from "@csa/selection-song-catalog";
import {
  draftManifestSong,
  isPlayable,
  type LoadedSource,
  measureLap,
} from "../ports/song/mod.ts";

export interface LapOutputOptions {
  /** 周回の成果物を世代ごとに置く場所(`intermediate/discs`) */
  discsDirectory: string;
  /** 前のビルドの中間ファイルを、入力が同じなら使い回す。`--full`では偽 */
  reuse: boolean;
}

export interface LapOutputs {
  /** 曲番号から全曲リストの行を引く表 */
  catalogRows: Map<number, CatalogRow>;
  /** `overlaySourceOf`の識別子 → オーバーレイの中身のハッシュ。全曲リストで外した行の分も持つ */
  contentPrints: Map<string, string>;
  copy: CopyLap;
  display: DisplayLap;
  /** 世代の行。収録する行と、全曲リストで外した行は、下書きの欄を埋めてある */
  rows: ManifestSongDraft[];
  sound: SoundLap;
  /** 素材側の識別子 → 音の本体とヘッダーのハッシュ。全曲リストで外した行の分も持つ */
  soundPrints: Map<string, SoundPrint>;
  /** 素材側の識別子 → 音とオーバーレイの、末尾のゼロを除いた長さ。全曲リストで外した行の分も持つ */
  sourceLengths: Map<string, number>;
}

/** `elfOf`は、前の周回で読んだ世代の実行ファイルも引く */
export async function writeLapOutputs(
  opened: Disc,
  source: LoadedSource,
  rows: readonly ManifestSongDraft[],
  catalogRows: Map<number, CatalogRow>,
  directories: LapOutputOptions,
  elfOf: (generation: string) => Uint8Array,
): Promise<LapOutputs> {
  const { elf, generation } = source;
  const drafted = draftedLapRows(
    rows,
    isPlayable,
    (row) => draftManifestSong(row, source),
  );
  const { ordered } = drafted;
  // 下の処理は渡した曲を書き換えることがあるので、写しを渡す
  const songs: DisplaySong[] = ordered.map((song) => structuredClone(song));
  // 表の全行の映像を書く。全曲リストで外した行の映像も、別の世代が採用することがある
  console.time(`time ${generation} video export`);
  const copy = await writeCopiedVideos(
    opened,
    generation,
    rows.flatMap((row) => row.sourceAssets),
    directories.discsDirectory,
    directories.reuse,
  );
  console.timeEnd(`time ${generation} video export`);
  console.log(
    `${generation} copied videos: reused ${copy.reused} / recopied ${
      copy.files.size - copy.reused
    }`,
  );
  // 曲リストの音のハッシュは、bundleのために読んだ音から求め、原盤を読み直さない
  const soundPrints = new Map<string, SoundPrint>();
  console.time(`time ${generation} sound bundle`);
  const sound = await writeSoundBundle(
    opened,
    generation,
    soundTargetsOfSongs(songs, generation),
    directories.discsDirectory,
    directories.reuse,
    async ({ asset, kind }, raw) => {
      soundPrints.set(
        soundSourceOf(generation, asset.sourceFileIndex),
        await soundPrint(kind, raw),
      );
    },
  );
  console.timeEnd(`time ${generation} sound bundle`);
  const measures = await measureLap(
    opened,
    generation,
    elf,
    rows.map((row) => row.sourceSongIndex),
    drafted.all,
    soundPrints,
  );
  console.time(`time ${generation} title cards and overlays`);
  const display = await prepareDisplayOfLap(
    lapDisplayManifest(songs, generation, source.manifest),
    generation,
    opened,
    directories,
    elfOf,
  );
  console.timeEnd(`time ${generation} title cards and overlays`);
  return {
    ...measures,
    catalogRows,
    copy,
    display,
    rows: drafted.rows,
    sound,
  };
}
