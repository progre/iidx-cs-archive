// 曲DBエントリのファイル参照を、manifestの資産の一覧にまとめる。

import type {
  AssetKind,
  AssetReference,
  FieldWidth,
  ManifestSong,
  SongmapSong,
} from "@csa/core";
import { KIND_ORDER } from "../candidates/assets/mod.ts";

function fail(message: string): never {
  throw new Error(message);
}

/** エントリの1つのフィールドと、それが示すファイルの通し番号 */
export interface FileReference {
  fieldOffset: number;
  fileIndex: number;
  width: FieldWidth;
}

/**
 * 使っているフィールドだけを返す。
 * まず種別で並べ、同じ種別の中ではフィールドの並び順に並べる。
 */
export interface EntryFileReferences {
  chart: readonly FileReference[];
  sound: readonly FileReference[];
  video: readonly FileReference[];
}

/** songmapのファイル表の1件。表の添字が通し番号に等しい */
export interface SongmapFileSlice {
  archive: string;
  index: number;
  offset: number;
  size: number;
}

/**
 * エントリが示すファイルを、songmapの種別と照合して資産にする。
 * `shareVideo`が真のとき、曲ごとの動画をABCへ置かない。
 * その場合は、動画フィールドを、共有動画を参照するフィールドとして返す。偽なら動画フィールドは空である。
 */
export function manifestAssetsOf(
  song: SongmapSong,
  files: readonly SongmapFileSlice[],
  references: EntryFileReferences,
  shareVideo: boolean,
): Pick<ManifestSong, "assets" | "videoFields"> {
  const charts = new Set(
    Object.values(song.charts).map((chart) => chart.chart),
  );
  const videos = new Set(song.videos);
  const bgms = new Set<number>();
  const keysounds = new Set<number>();
  for (const sound of song.sounds) {
    if (sound.bgm !== null) {
      bgms.add(sound.bgm);
    }
    if (sound.keysound !== null) {
      keysounds.add(sound.keysound);
    }
  }

  const assets = new Map<
    number,
    { kind: AssetKind; references: AssetReference[] }
  >();
  const add = (
    fileIndex: number,
    kind: AssetKind,
    reference: AssetReference,
  ) => {
    const known = kind === "chart"
      ? charts
      : kind === "video"
      ? videos
      : kind === "bgm"
      ? bgms
      : keysounds;
    if (!known.has(fileIndex)) {
      fail(
        `song${song.song_id}+0x${
          reference.fieldOffset.toString(16)
        }=${fileIndex} がsongmapの${kind}に無い`,
      );
    }
    const current = assets.get(fileIndex);
    if (current && current.kind !== kind) {
      fail(
        `song${song.song_id} file${fileIndex} が${current.kind}と${kind}を兼ねる`,
      );
    }
    if (current) {
      current.references.push(reference);
    } else {
      assets.set(fileIndex, { kind, references: [reference] });
    }
  };

  const videoFields: number[] = [];
  for (const { fieldOffset, fileIndex, width } of references.video) {
    if (shareVideo) {
      videoFields.push(fieldOffset);
    } else {
      add(fileIndex, "video", { fieldOffset, width });
    }
  }
  for (const { fieldOffset, fileIndex, width } of references.chart) {
    add(fileIndex, "chart", { fieldOffset, width });
  }
  for (const { fieldOffset, fileIndex, width } of references.sound) {
    const isBgm = bgms.has(fileIndex);
    const isKeysound = keysounds.has(fileIndex);
    if (isBgm === isKeysound) {
      fail(`song${song.song_id} sound file${fileIndex}の種別が一意でない`);
    }
    add(fileIndex, isBgm ? "bgm" : "keysound", { fieldOffset, width });
  }

  const rows = [...assets.entries()].map(([sourceFileIndex, item]) => {
    const source = files[sourceFileIndex];
    if (!source || source.index !== sourceFileIndex) {
      fail(`files[${sourceFileIndex}]が不正`);
    }
    item.references.sort((a, b) => a.fieldOffset - b.fieldOffset);
    return {
      kind: item.kind,
      references: item.references,
      sourceArchive: source.archive,
      sourceFileIndex,
      sourceOffset: source.offset,
      sourceSize: source.size,
    };
  }).sort((a, b) =>
    KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
    a.references[0].fieldOffset - b.references[0].fieldOffset
  );
  return { assets: rows, videoFields };
}
