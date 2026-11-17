// 全曲リストの行から、曲ごとに4枠へ描く文字を選ぶ。

import type { ImageSetKind, TextKind, TextSegment } from "@csa/core";

export const TEXT_KIND: Record<ImageSetKind, TextKind> = {
  artist: "artist",
  big: "bigTitle",
  genre: "genre",
  small: "listTitle",
};

export const KINDS = Object.keys(TEXT_KIND) as ImageSetKind[];

/** 全曲リストの行のうち、枠の文字になる列 */
export interface SlotTexts {
  artist: string | null;
  fullTitle: string | null;
  genre: string | null;
  subtitle: string | null;
}

/** 枠ごとの描く文字。文字が無ければnull */
export function segmentsOf(
  kind: ImageSetKind,
  row: SlotTexts,
): TextSegment[] | null {
  const { genre, fullTitle, subtitle, artist } = row;
  switch (kind) {
    case "genre":
      return genre == null ? null : [{ text: genre }];
    case "artist":
      return artist == null ? null : [{ text: artist }];
    case "big":
      if (fullTitle == null) {
        return null;
      }
      return subtitle == null
        ? [{ text: fullTitle }]
        : [{ text: fullTitle }, { text: subtitle, subtitle: true }];
    case "small":
      if (fullTitle == null) {
        return null;
      }
      // 曲リストの曲名は、本題の後ろに空白と副題を並べる
      return subtitle == null
        ? [{ text: fullTitle }]
        : [{ text: fullTitle }, { text: " " + subtitle, subtitle: true }];
  }
}
