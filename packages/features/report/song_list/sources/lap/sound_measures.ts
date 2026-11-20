// 世代の音のハッシュと長さを求める。曲リストは、ハッシュで同じファイルかどうかを見分け、長さを容量として出す。
// 長さは、末尾のゼロを除いた長さである。
// 全曲リストで外した行の音も求める。音は1本ずつ読み切り、同じバイト列からハッシュと長さを求める。

import {
  discOffsetOf,
  inDiscOrder,
  inKeyOrder,
  isProgressStep,
  type ManifestSongDraft,
  type OpenDisc,
  SEC,
  type SoundPrint,
  type SoundPrintKind,
} from "@csa/core";
import { soundSourceOf } from "../../data/rows/mod.ts";
import type { LapMeasurePorts } from "../../ports.ts";

type SoundPorts = Pick<LapMeasurePorts, "contentLength" | "soundPrint">;

const isSoundKind = (kind: string): kind is SoundPrintKind =>
  kind === "bgm" || kind === "keysound";

/** 識別子`世代:file index`で引く、音のハッシュと長さ */
export interface SoundMeasures {
  lengths: Map<string, number>;
  prints: Map<string, SoundPrint>;
}

/** 読んだバイト列から、末尾のゼロを除いた長さを数える */
export const soundLengthOf = (
  ports: Pick<LapMeasurePorts, "contentLength">,
  bytes: Uint8Array,
): Promise<number> =>
  ports.contentLength(
    bytes.length,
    (offset, length) =>
      Promise.resolve(bytes.subarray(offset, offset + length)),
  );

/** `known`にある音は、原盤から読まない */
export async function soundMeasuresOf(
  ports: SoundPorts,
  { disc, files }: OpenDisc,
  generation: string,
  songs: Iterable<ManifestSongDraft>,
  known: SoundMeasures,
): Promise<SoundMeasures> {
  const prints = new Map(known.prints);
  const lengths = new Map(known.lengths);
  const songAssets = [...songs].flatMap((song) =>
    (song.assets ?? []).flatMap((asset) =>
      isSoundKind(asset.kind) ? [{ ...asset, kind: asset.kind }] : []
    )
  );
  const assets = inDiscOrder(
    songAssets,
    (asset) => discOffsetOf(files, asset.sourceArchive, asset.sourceOffset),
  );
  for (const [done, asset] of assets.entries()) {
    if (isProgressStep(done + 1, assets.length)) {
      console.log(`${done + 1}/${assets.length} ${generation} sound print`);
    }
    const source = soundSourceOf(generation, asset.sourceFileIndex);
    if (prints.has(source) && lengths.has(source)) {
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
    prints.set(
      source,
      await ports.soundPrint(asset.kind, bytes),
    );
    lengths.set(source, await soundLengthOf(ports, bytes));
  }
  // 曲リストは表の並びのまま書くので、読んだ順ではなく曲の順に戻す
  const sources = songAssets.map((asset) =>
    soundSourceOf(generation, asset.sourceFileIndex)
  );
  return {
    lengths: inKeyOrder(lengths, [...known.lengths.keys(), ...sources]),
    prints: inKeyOrder(prints, [...known.prints.keys(), ...sources]),
  };
}
