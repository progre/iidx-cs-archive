// 文字の断片を基準線に並べ、キャップハイトで大きさを決め、横を縮めた輪郭と変換を求める。

import type { TextSegment } from "@csa/core";
import type { GlyphFont, GlyphPath, PathCommand } from "./font.ts";
import type { TextStyle } from "./style.ts";

export type { TextSegment };

export interface TextLayout {
  /**
   * 断片ごとのSVGのpathのd属性。`MEASURE_SIZE`の大きさで描き、横だけ縮めた輪郭。
   * 濃淡は要素ごとの外接矩形に掛かるので、断片を分けると副題にも上端から濃淡が付く
   */
  pathData: string[];
  /** 輪郭を縁の内側へ収めるSVGのtransform属性。縦横を同じ倍率で縮める */
  transform: string;
  /** 1pxに当たるtransform前の長さ。縁の線の幅をpxで決めるのに使う */
  unit: number;
  width: number;
  height: number;
  /** 縦の濃淡を掛ける範囲。transform前の長さで表す。無ければ断片ごとの外接矩形に掛ける */
  gradientSpan?: { y1: number; y2: number };
}

/** 輪郭を描く大きさ。描いた後にtransformで目的の大きさへ縮める */
const MEASURE_SIZE = 100;
const OPTIONS = { kerning: true };

type Box = ReturnType<GlyphPath["getBoundingBox"]>;

interface Placed {
  commands: PathCommand[];
  box: Box;
}

/** 字の送り幅。次の字とのカーニングは、2字続けた送り幅から次の字の送り幅を引いて含める */
function advanceOf(
  font: GlyphFont,
  char: string,
  next: string | undefined,
  size: number,
) {
  const pair = font.getAdvanceWidth(char + (next ?? ""), size, OPTIONS);
  return next == null ? pair : pair - font.getAdvanceWidth(next, size, OPTIONS);
}

/** 断片を1字ずつ並べる。字の間は`letterSpacing`だけ詰める */
function placed(
  font: GlyphFont,
  segments: TextSegment[],
  style: TextStyle,
): Placed[] {
  let x = 0;
  return segments.map((segment) => {
    const size = MEASURE_SIZE * (segment.subtitle ? style.subtitleScale : 1);
    const chars = [...segment.text];
    const paths = chars.map((char, i) => {
      const path = font.getPath(char, x, 0, size, OPTIONS);
      x += advanceOf(font, char, chars[i + 1], size) +
        style.letterSpacing * size;
      return path;
    });
    // 空白の字は輪郭を持たず、外接矩形が字の位置を表さないので除く
    const boxes = paths.filter((path) => path.commands.length > 0)
      .map((path) => path.getBoundingBox());
    return {
      commands: paths.flatMap((path) => path.commands),
      box: {
        x1: Math.min(...boxes.map((b) => b.x1)),
        y1: Math.min(...boxes.map((b) => b.y1)),
        x2: Math.max(...boxes.map((b) => b.x2)),
        y2: Math.max(...boxes.map((b) => b.y2)),
      },
    };
  });
}

const n = (v?: number) => Number(v!.toFixed(2));

/**
 * 横の縮めは座標に掛ける。
 * transformで縦横の倍率を変えると、縁の線も横だけ細くなる。
 */
function pathDataOf(commands: PathCommand[], xScale: number): string {
  const x = (v?: number) => n(v! * xScale);
  return commands.map((c) => {
    switch (c.type) {
      case "M":
      case "L":
        return `${c.type}${x(c.x)} ${n(c.y)}`;
      case "Q":
        return `Q${x(c.x1)} ${n(c.y1)} ${x(c.x)} ${n(c.y)}`;
      case "C":
        return `C${x(c.x1)} ${n(c.y1)} ${x(c.x2)} ${n(c.y2)} ` +
          `${x(c.x)} ${n(c.y)}`;
      case "Z":
        return "Z";
    }
  }).join("");
}

/**
 * 大文字Hの高さが`capHeight`になる倍率で描き、横は`widthScale`を掛ける。
 * 画像の大きさは、文字の外接矩形に縁とぼかしの幅を足したもの。`maxWidth`・`maxHeight`を超えない。
 * 画像の上には、`offsetY`の高さの透明な行を足す。
 */
export function layoutText(
  font: GlyphFont,
  segments: TextSegment[],
  style: TextStyle,
): TextLayout {
  const paths = placed(font, segments, style);
  const boxes = paths.map((path) => path.box);
  const glyphWidth = Math.max(...boxes.map((b) => b.x2)) -
    Math.min(...boxes.map((b) => b.x1));
  const top = Math.min(...boxes.map((b) => b.y1));
  const glyphHeight = Math.max(...boxes.map((b) => b.y2)) - top;
  const cap = font.getPath("H", 0, 0, MEASURE_SIZE, OPTIONS).getBoundingBox();
  const margin = style.outline + style.outlineSoftness;
  const capScale = style.capHeight / (cap.y2 - cap.y1);
  // 基準線を決めない種類は、高さが上限を超えたら全体を縮める
  const scale = style.baseline !== undefined ? capScale : Math.min(
    capScale,
    (style.maxHeight - margin * 2 - style.offsetY) / glyphHeight,
  );
  // 幅が上限を超えたら横だけを縮める
  const xScale = Math.min(
    style.widthScale,
    (style.maxWidth - margin * 2) / (glyphWidth * scale),
  );
  const left = Math.min(...boxes.map((b) => b.x1)) * xScale;
  const size = (v: number, max: number) =>
    Math.min(max, Math.ceil(v + margin * 2));
  const common = {
    pathData: paths.map((path) => pathDataOf(path.commands, xScale)),
    unit: 1 / scale,
    width: size(glyphWidth * xScale * scale, style.maxWidth),
  };
  if (style.baseline !== undefined) {
    // 輪郭の座標は基準線が0なので、基準線を指定の高さへ動かすだけでよい
    const { baseline, maxHeight } = style;
    return {
      ...common,
      transform: `translate(${margin} ${baseline}) ` +
        `scale(${scale}) translate(${-left} 0)`,
      height: maxHeight,
      gradientSpan: {
        y1: -baseline / scale,
        y2: (maxHeight - baseline) / scale,
      },
    };
  }
  return {
    ...common,
    transform: `translate(${margin} ${margin + style.offsetY}) ` +
      `scale(${scale}) translate(${-left} ${-top})`,
    height: size(glyphHeight * scale + style.offsetY, style.maxHeight),
  };
}
