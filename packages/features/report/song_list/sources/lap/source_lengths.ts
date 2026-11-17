// 世代の音とオーバーレイの中身の長さを、原盤から数える。曲リストは、この長さを容量として出す。
// 音は末尾のゼロを除いた長さである。
// オーバーレイは、9th以降は`.if`の記述子が示す長さ、3rd〜8thはファイル表の大きさである。
// 3rd〜8thの`.if`はPBと形が違うので、記述子から長さを求められない。
// ファイル表に書かれた大きさはセクタ単位に丸めた値ではないので、これを長さとして使う。
// 中身が同じファイルは、世代が違っても同じ値になる。bundleに詰めた後の大きさは、世代の変換で変わるので使わない。
// 曲リストは外した曲の行にも容量を表示するので、全曲リストで外した曲のファイルも数える。
// 音は下書きの資産から、オーバーレイは`overlaySlicesOf`が示す位置から数える。

import {
  isProgressStep,
  type ManifestSongDraft,
  type OpenDisc,
  SEC,
  type SourceSlice,
} from "@csa/core";
import { overlaySourceOf, soundSourceOf } from "../../data/rows/mod.ts";
import type { LapMeasurePorts } from "../../ports.ts";

type LengthPorts = Pick<
  LapMeasurePorts,
  "contentLength" | "ifPayloadLength" | "isLegacyOverlay"
>;

const SOUND_KINDS: readonly string[] = ["bgm", "keysound"];

type Read = (offset: number, length: number) => Promise<Uint8Array>;

/** 長さを引くときの識別子、原盤上の位置、長さの数え方 */
type Measured = readonly [
  source: string,
  slice: SourceSlice,
  lengthOf: (size: number, read: Read) => Promise<number>,
];

const soundsOf = (
  ports: LengthPorts,
  generation: string,
  song: ManifestSongDraft,
): Measured[] =>
  (song.assets ?? [])
    .filter((asset) => SOUND_KINDS.includes(asset.kind))
    .map((asset): Measured => [
      soundSourceOf(generation, asset.sourceFileIndex),
      asset,
      ports.contentLength,
    ]);

/** 識別子 → 長さ。音は`世代:file index`、オーバーレイは`overlaySourceOf`の識別子で引く */
export async function sourceLengthsOf(
  ports: LengthPorts,
  { disc, files }: OpenDisc,
  generation: string,
  songs: Iterable<ManifestSongDraft>,
  overlays: readonly SourceSlice[],
): Promise<Map<string, number>> {
  const lengths = new Map<string, number>();
  const measured = [
    ...[...songs].flatMap((song) => soundsOf(ports, generation, song)),
    ...overlays.map((slice): Measured => [
      overlaySourceOf(generation, slice.sourceFileIndex),
      slice,
      ports.isLegacyOverlay(generation)
        ? (size) => Promise.resolve(size)
        : (_size, read) => ports.ifPayloadLength(read),
    ]),
  ];
  for (const [done, [source, slice, lengthOf]] of measured.entries()) {
    if (isProgressStep(done + 1, measured.length)) {
      console.log(`${done + 1}/${measured.length} ${generation} length`);
    }
    if (lengths.has(source)) {
      continue;
    }
    const archiveName = slice.sourceArchive.toUpperCase().split(";")[0];
    const archive = files.get(archiveName);
    if (archive === undefined) {
      throw new Error(`source ISOに${archiveName}が無い`);
    }
    const start = archive.lba * SEC + slice.sourceOffset;
    lengths.set(
      source,
      await lengthOf(
        slice.sourceSize,
        (offset, length) => disc.readAt(start + offset, length),
      ),
    );
  }
  return lengths;
}
