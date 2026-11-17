// キー音とBGMを変換する。変換した音は、世代ごとに1本のbundleへ書く。
// 変換して変わらない音(era2・era3のBGMとキー音)も、原盤の範囲をそのまま同じbundleへ書く。
// どの音を並べ、同じ範囲の音を2度書くかは、呼び出し側が`ports`で決める。

import { isProgressStep, type OpenDisc, SEC } from "@csa/core";
import {
  type ConvertedSound,
  convertSound,
  sameBytes,
} from "../convert/mod.ts";
import { BundleFile } from "./bundle_gateway.ts";
import {
  bundleSizeOf,
  readSoundLapRecord,
  removeSoundLapRecord,
  type SoundLapRecord,
  writeSoundLapRecord,
} from "./lap_record_gateway.ts";
import { LaterUses } from "./later_uses.ts";
import type { SoundBundlePorts } from "./ports.ts";

/** `unchanged`は、変換しても原盤のバイト列のままか */
type ReadSound = ConvertedSound & { unchanged: boolean };

/** bundleと、その記録のファイルの置き場 */
export interface SoundBundlePaths {
  bundle: string;
  record: string;
}

export interface WrittenSoundBundle<O> {
  /** 1つも書かなければ`undefined` */
  bundlePath: string | undefined;
  occurrences: O[];
}

/**
 * 前のビルドの記録を読み、使い回せるなら返す。
 * 音の並びとbundleの大きさのうち、1つでも今と違えば使い回さない
 */
function reusableRecord<O>(
  paths: SoundBundlePaths,
  keys: readonly string[],
): SoundLapRecord<O> | undefined {
  const record = readSoundLapRecord<O>(paths.record);
  const same = record !== undefined &&
    record.keys.length === keys.length &&
    record.keys.every((key, i) => key === keys[i]) &&
    record.bundleSize === bundleSizeOf(paths.bundle);
  return same ? record : undefined;
}

/** 音を開いてある原盤から読む。アーカイブが無ければ例外にする */
function readSound<T>(
  { disc, files }: OpenDisc,
  place: ReturnType<SoundBundlePorts<T, unknown>["placeOf"]>,
): Promise<Uint8Array> {
  const archive = files.get(place.archiveName);
  if (archive === undefined) {
    throw new Error(`source ISOに${place.archiveName}が無い`);
  }
  return disc.readAt(archive.lba * SEC + place.offset, place.size);
}

/**
 * 世代の音を、`targets`の並びのまま変換して書く。音は`disc`から読む。
 * `reuse`が真で、前のビルドが同じ並びの音を書いていれば、変換せずにそのbundleを使う
 */
export async function writeSoundBundle<T, O>(
  ports: SoundBundlePorts<T, O>,
  disc: OpenDisc,
  generation: string,
  targets: readonly T[],
  paths: SoundBundlePaths,
  reuse: boolean,
): Promise<WrittenSoundBundle<O>> {
  const keys = targets.map(ports.keyOf);
  const saved = reuse ? reusableRecord<O>(paths, keys) : undefined;
  console.log(`${generation} sound bundle: ${saved ? "reused" : "rebuilt"}`);
  if (saved !== undefined) {
    return {
      bundlePath: saved.occurrences.length > 0 ? paths.bundle : undefined,
      occurrences: saved.occurrences,
    };
  }
  removeSoundLapRecord(paths.record);
  const occurrences = ports.newOccurrences();
  const rangeKey = (target: T) => {
    const place = ports.placeOf(target);
    return [ports.kindOf(target), place.archiveName, place.offset, place.size]
      .join("\t");
  };
  // 変換して中身が変わる音は、同じ範囲でも出てくるたびにbundleへ書く。原盤からは1度だけ読む
  const uses = new LaterUses<ReadSound>(targets.map(rangeKey));
  const file = new BundleFile(paths.bundle);
  try {
    for (const [done, target] of targets.entries()) {
      if (isProgressStep(done + 1, targets.length)) {
        console.log(`${done + 1}/${targets.length} ${generation} sound`);
      }
      const result = await uses.take(rangeKey(target), async () => {
        const raw = await readSound(disc, ports.placeOf(target));
        await ports.onRead(target, raw);
        const sound = convertSound(
          ports.rules,
          ports.kindOf(target),
          generation,
          raw,
        );
        return { ...sound, unchanged: sameBytes(sound.bytes, raw) };
      });
      const { unchanged } = result;
      const converted = {
        size: result.bytes.length,
        soundMap: result.soundMap,
      };
      if (occurrences.add(target, converted, unchanged)) {
        await file.append(result.bytes);
      }
    }
  } finally {
    file.close();
  }
  // 記録は、bundleを書き終えてから書く
  writeSoundLapRecord(paths.record, {
    bundleSize: bundleSizeOf(paths.bundle),
    keys,
    occurrences: occurrences.list,
  });
  return {
    bundlePath: occurrences.list.length > 0 ? paths.bundle : undefined,
    occurrences: occurrences.list,
  };
}
