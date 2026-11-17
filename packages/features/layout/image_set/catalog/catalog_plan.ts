// 全曲リストの文字を、どの曲のどの枠に描くかを決める。描画は呼び出し側が行う。
// legacy(3rd〜8th)の曲は素材の画像セットが無いので、4枠とも描く。
// 文字の無い枠には、透明な1枚を全曲で共有して使う。
// ほかの曲は文字を書いた枠だけを描き、残りの枠は素材のspriteを使う。

import type { Image, ImageSetKind, ManifestSong, TextSegment } from "@csa/core";
import { KINDS, segmentsOf, type SlotTexts } from "./catalog_text.ts";

export interface CatalogImage {
  image: Image;
  /** この絵を使う曲。透明な絵は複数の曲で共有する */
  targets: number[];
}

/** 枠に描く1枚の絵である。`segments`がnullのときは、文字の無い枠で共有する透明な絵になる */
export interface CatalogEntry {
  kind: ImageSetKind;
  segments: TextSegment[] | null;
  targets: number[];
}

export interface CatalogPlan {
  /** 曲の順に並べた文字の絵の後ろへ、枠ごとの透明な絵を並べる */
  entries: CatalogEntry[];
  /** 4枠のどれかの文字が全曲リストに無く、透明な絵で埋めるlegacyの曲 */
  incomplete: string[];
  /** 曲のtargetSongIndex → この絵で埋める枠。legacyの曲は4枠とも */
  drawn: Map<number, Set<ImageSetKind>>;
}

/** 文字の無い枠に使う絵である。透明なので何も描かれない */
export const BLANK: Image = { height: 1, rgba: new Uint8Array(4), width: 1 };

/** 曲ごとに描く枠を決める。`rowOf`は曲の全曲リストの行を返し、行が無ければundefinedを返す */
export function planCatalog(
  songs: readonly ManifestSong[],
  rowOf: (song: ManifestSong) => SlotTexts | undefined,
  hasDisplayAssets: (generation: string) => boolean,
): CatalogPlan {
  const draws: CatalogEntry[] = [];
  const blanks = new Map(KINDS.map((kind) => [kind, [] as number[]]));
  const incomplete: string[] = [];
  const drawn = new Map<number, Set<ImageSetKind>>();
  for (const song of songs) {
    const row = rowOf(song);
    const texts = KINDS.map((kind) =>
      row == null ? null : segmentsOf(kind, row)
    );
    const legacy = !hasDisplayAssets(song.sourceGeneration);
    if (legacy && texts.includes(null)) {
      incomplete.push(`${song.sourceGeneration}/${song.title}`);
    }
    const kinds = new Set<ImageSetKind>();
    for (const [i, kind] of KINDS.entries()) {
      const segments = texts[i];
      if (segments == null) {
        if (legacy) {
          blanks.get(kind)!.push(song.targetSongIndex);
          kinds.add(kind);
        }
        continue;
      }
      draws.push({ kind, segments, targets: [song.targetSongIndex] });
      kinds.add(kind);
    }
    if (kinds.size > 0) {
      drawn.set(song.targetSongIndex, kinds);
    }
  }
  const shared = KINDS.flatMap((kind) => {
    const targets = blanks.get(kind)!;
    return targets.length > 0 ? [{ kind, segments: null, targets }] : [];
  });
  return { entries: [...draws, ...shared], incomplete, drawn };
}

/** 絵を描く。文字の無い枠は`render`を呼ばず、共有の透明な絵を返す */
export function drawEntry(
  entry: CatalogEntry,
  render: (segments: TextSegment[], kind: ImageSetKind) => Promise<Image>,
): Promise<Image> {
  return entry.segments === null
    ? Promise.resolve(BLANK)
    : render(entry.segments, entry.kind);
}

/** 枠に描く絵を、計画の並びのまま返す。描く絵が無ければundefinedを返す */
export function entriesOfKind(
  entries: readonly CatalogEntry[],
  kind: ImageSetKind,
): CatalogEntry[] | undefined {
  const ofKind = entries.filter((entry) => entry.kind === kind);
  return ofKind.length === 0 ? undefined : ofKind;
}
