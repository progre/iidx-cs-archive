// 全曲リストの文字をフォントで描き、PBの共有画像セットへ足せる絵の並びにする。
// 文字の描画と全曲リストの行の読み出しは`ports`で受ける。

import type { Image, ImageSetKind, ManifestSong, TextSegment } from "@csa/core";
import {
  type CatalogImage,
  drawEntry,
  entriesOfKind,
  planCatalog,
} from "./catalog_plan.ts";
import { type SlotTexts, TEXT_KIND } from "./catalog_text.ts";
import { generationsOf } from "../title/mod.ts";

type TextKind = typeof TEXT_KIND[ImageSetKind];

export interface CatalogImagePorts {
  /** 全曲リストの行番号から行を引く。行番号の無い曲は`undefined` */
  catalogRowAt: (
    generation: string,
    line: number | undefined,
  ) => SlotTexts | undefined;
  hasDisplayAssets: (generation: string) => boolean;
  /** 文字の見た目を読み、文字を描く関数を返す */
  openTextRenderer: () => Promise<
    (segments: TextSegment[], kind: TextKind) => Promise<Image>
  >;
}

export interface CatalogImageSet {
  /** 枠の絵を描く。描く絵が無ければundefinedを返す。4枠の絵を同時にメモリーに持たないよう、枠ごとに描く */
  draw: (kind: ImageSetKind) => Promise<CatalogImage[] | undefined>;
  /** 一部の枠を透明な絵で埋めるlegacyの曲。全曲リストに文字が無い枠を、透明な絵で埋める */
  incomplete: string[];
  /** 曲のtargetSongIndex → この絵で埋める枠。legacyの曲は4枠とも */
  drawn: Map<number, Set<ImageSetKind>>;
}

/** 曲ごとに文字を書く枠を決める。文字は曲の全曲リストの行から取り、行番号の無い曲は`rowsOf`が曲番号で引く */
export async function catalogImages(
  ports: CatalogImagePorts,
  songs: ManifestSong[],
  rowsOf: (generation: string) => ReadonlyMap<number, SlotTexts>,
): Promise<CatalogImageSet> {
  const render = await ports.openTextRenderer();
  const catalogs = new Map(
    generationsOf(songs).map((generation) => [generation, rowsOf(generation)]),
  );
  const plan = planCatalog(
    songs,
    (song) =>
      ports.catalogRowAt(song.sourceGeneration, song.catalogLine) ??
        catalogs.get(song.sourceGeneration)?.get(song.sourceSongIndex),
    ports.hasDisplayAssets,
  );
  const draw = async (kind: ImageSetKind) => {
    const entries = entriesOfKind(plan.entries, kind);
    if (entries === undefined) {
      return undefined;
    }
    const images: CatalogImage[] = [];
    for (const entry of entries) {
      const image = await drawEntry(
        entry,
        (segments) => render(segments, TEXT_KIND[kind]),
      );
      images.push({ image, targets: entry.targets });
    }
    return images;
  };
  return { draw, drawn: plan.drawn, incomplete: plan.incomplete };
}
