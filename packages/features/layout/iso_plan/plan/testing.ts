// 配置計画のテストが共有するmanifestの雛形。
// 曲名は原作と重ならない作り物にする。配置計画は曲DBの中身を読まないので、entryは空にする。

import type { IndividualAssetManifest } from "@csa/core";

/** 譜面の参照が書き込まれる欄の位置。配置計画は値を読まず、そのまま写す */
const CHART_FIELD_OFFSET = 0x20;

export function assertEquals<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: ${String(actual)} != ${String(expected)}`);
  }
}

const FIXTURE_TITLES = ["ZZZFAKE A", "ZZZFAKE B", "ZZZFAKE C"];

export function fixture(): IndividualAssetManifest {
  return {
    expectedNewAbcCount: 3,
    sources: {
      "djt": {
        elf: "unused",
        entryRanges: [[0, 1]],
        songmap: "unused",
      },
    },
    targetSongCount: 102,
    songs: Array.from({ length: 3 }, (_, index) => ({
      assets: [{
        kind: "chart" as const,
        references: [{
          fieldOffset: CHART_FIELD_OFFSET,
          width: "u32" as const,
        }],
        sourceArchive: "SOURCE.DAT",
        sourceFileIndex: index,
        sourceOffset: index * 2048,
        sourceSize: 2048,
      }],
      canonicalKey: `KEY${index}`,
      entry: "",
      sourceGeneration: "djt",
      sourceSongIndex: index,
      targetSongIndex: 99 + index,
      title: FIXTURE_TITLES[index],
      // 3曲のうち2曲が同じ曲名カードを共有し、DATA1は2件になる
      titleCard: {
        pairs: [{ animation: 0, titleCard: 300 + (index >> 1) }],
        sourceArchive: "data1.dat",
        sourceFileIndex: 300 + (index >> 1),
        sourceOffset: (index >> 1) * 4096,
        sourceSize: 4096,
      },
      videoFields: [],
    })),
  };
}

export const planInput = {
  abcCapacity: 1069,
  imageSetFiles: [],
  data1BaseLba: 50,
  reusableRanges: [],
  sourceVolumeSectors: 100,
};

/** 先頭2曲がオーバーレイを持ち、うち1本を共有する写し。3曲目は持たない */
export function withOverlay(): IndividualAssetManifest {
  const manifest = fixture();
  for (const index of [0, 1]) {
    manifest.songs[index].overlay = {
      packages: [{
        sourceArchive: "data1.dat",
        sourceFileIndex: 400,
        sourceOffset: 0,
        sourceSize: 8192,
      }],
      // 枠0は空で、枠1に組を置く
      pairs: [null, { animation: 1, packageIndex: 0 }],
    };
  }
  manifest.songs[1].overlay!.packages.push({
    sourceArchive: "data1.dat",
    sourceFileIndex: 401,
    sourceOffset: 8192,
    sourceSize: 4096,
  });
  return manifest;
}

/** 3曲目を1曲目の裏エントリー(演奏中のBGM差し替え先)にした写し */
export function withVariant(): IndividualAssetManifest {
  const manifest = fixture();
  const variant = manifest.songs[2];
  variant.targetSongIndex = manifest.targetSongCount;
  variant.variantOf = { rule: "always", targetSongIndex: 99 };
  return manifest;
}
