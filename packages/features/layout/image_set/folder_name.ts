// 追加のバージョン別フォルダーの名前の画像を、PBの画像セットへ足すときの写し元と写し先を決める。

import type { IndividualAssetManifest } from "@csa/core";

/** PBの画像セットに該当する文字が無いので、empの画像セットから写す */
export const FOLDER_NAME_GENERATION = "emp";

/**
 * 写し先の画像セットのDATA1番号である。選曲画面では、この画像セットが常に読み込まれている。
 * 大きな名前は、PBでは画像セット1317にある。
 * 1317はsprite表を延ばすと、animationの位置を付け直さなければならない。
 * そのため、こちらへ足す。
 */
export const TARGET_SET = 0;

export type FolderNameKind = "big" | "label";

export const COPIES: readonly {
  kind: FolderNameKind;
  sourceSet: number;
  sprite: number;
}[] = [
  { kind: "label", sourceSet: 0, sprite: 80 },
  { kind: "big", sourceSet: 303, sprite: 105 },
];

/** 写し元の世代が収録に無ければfalseを返す。そのときは名前の画像を足さない */
export function hasFolderNameSource(
  manifest: IndividualAssetManifest,
): boolean {
  return manifest.sources[FOLDER_NAME_GENERATION] !== undefined;
}

/** 曲DBの追加フォルダー欄に書く値である。上位16bitが画像セット、下位16bitがspriteである */
export function folderNameImage(sprite: number): number {
  return (TARGET_SET << 16) | sprite;
}

/** 名前の画像を足した画像セットを、配置器へ渡すファイルの記述にする */
export function folderNameFile<Bytes>(
  bytes: Bytes,
  summaries: readonly string[],
): { bytes: Bytes; data1Index: number; summary: string } {
  return {
    bytes,
    data1Index: TARGET_SET,
    summary: `folder names[${TARGET_SET}] ${summaries.join(" / ")}`,
  };
}
