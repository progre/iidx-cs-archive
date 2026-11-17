// 3rd〜8thの曲名カードと曲中オーバーレイをPB形式で組み直したとき、
// manifestの曲の参照を置いたファイルへ向ける。バイト列は扱わない。

import {
  type DisplaySong,
  type ManifestOverlayPackage,
  overlayKey,
  type TitleCardPair,
} from "@csa/core";
import type { RepackedFile } from "./repack.ts";

/** 組は1本だけ。DATA1 indexは配置器が割り当てるので、有無だけを1で表す */
const CARD_PAIRS: TitleCardPair[] = [{ animation: 0, titleCard: 1 }];

/** 曲名カードを組んだ曲。カードの置き場所は`<root>/<世代>/NNNN.if` */
export const withLegacyTitleCard = <S extends DisplaySong>(
  song: S,
  file: RepackedFile,
): S => ({
  ...song,
  titleCard: {
    pairs: CARD_PAIRS,
    sourceArchive: file.archive,
    sourceFileIndex: song.sourceSongIndex,
    sourceOffset: 0,
    sourceSize: file.size,
  },
});

/** 組み直した本1本に向けた曲。枠は載せ済みなので`packages`だけを差し替える */
export const withLegacyOverlay = <S extends DisplaySong>(
  song: S,
  item: ManifestOverlayPackage,
  file: RepackedFile,
): S => ({
  ...song,
  overlay: {
    packages: [{
      ...item,
      sourceArchive: file.archive,
      sourceOffset: 0,
      sourceSize: file.size,
    }],
    pairs: song.overlay!.pairs,
  },
});

/**
 * 配置器は変換前の鍵で本を数え、変換後のpathで実体を引く。両者が1対1でないと
 * 同じ本が二重に置かれたり、別の本が1件に潰れたりする
 */
export function recordOverlayPath(
  paths: Map<string, string>,
  generation: string,
  item: ManifestOverlayPackage,
  path: string,
): void {
  const key = overlayKey(generation, item);
  const seen = paths.get(key) ?? path;
  if (seen !== path) {
    throw new Error(`オーバーレイの鍵${key}が${seen}と${path}を指す`);
  }
  paths.set(key, path);
}

/**
 * 組み直す本。オーバーレイを持たない曲はnullである。
 * 組み直せる本は1本だけで、1曲が複数の本を指す曲は取り違えを避けて止める。
 */
export function legacyOverlayPackage(
  song: DisplaySong,
): ManifestOverlayPackage | null {
  if (song.overlay === undefined) {
    return null;
  }
  const item = song.overlay.packages[0];
  if (song.overlay.packages.length !== 1 || item === undefined) {
    throw new Error(
      `${song.sourceGeneration} ${song.title}のパッケージが1本でない`,
    );
  }
  return item;
}
