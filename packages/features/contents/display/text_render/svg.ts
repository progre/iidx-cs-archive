// 配置した輪郭とエフェクトの設定からSVGを組み立てる。

import type { TextLayout } from "./layout.ts";
import type { GradientStop, TextLook } from "./style.ts";

function stopsOf(gradient: GradientStop[]): string {
  return gradient
    .map(({ at, color }) => `<stop offset="${at}" stop-color="${color}"/>`)
    .join("");
}

/**
 * 縁は2重に描く。
 * 内側の縁は、アンチエイリアスを切って真っ黒に描く。
 * アンチエイリアスを掛けると、細い縁は半透明の灰色になって薄く見える。
 * 外側の縁は少し太くし、アンチエイリアスを掛けて外周をぼかす。
 * 縁の上に、縦の濃淡で塗った文字を重ねる。
 * 濃淡の範囲は、断片ごとの外接矩形の上端から下端までとする。
 * 配置が範囲を決めていれば、その範囲に掛ける。
 * 縁は全部の断片を先に描き、隣の断片の縁が塗りに重ならないようにする。
 */
export function svgOf(
  layout: TextLayout,
  look: Pick<TextLook, "outline" | "outlineSoftness" | "gradient">,
): string {
  const { pathData, transform, unit, width, height } = layout;
  const { outline, outlineSoftness, gradient } = look;
  const paths = pathData.map((d) => `d="${d}" transform="${transform}"`);
  const stroke = (px: number, crisp: boolean) =>
    paths.map((path) =>
      `<path ${path} fill="#000" stroke="#000" ` +
      `stroke-width="${px * 2 * unit}" stroke-linejoin="round"` +
      (crisp ? ` shape-rendering="crispEdges"/>` : "/>")
    );
  const outlines = [
    ...stroke(outline + outlineSoftness, false),
    ...stroke(outline, true),
  ];
  const fills = paths.map((path) => `<path ${path} fill="url(#fill)"/>`);
  const span = layout.gradientSpan;
  const direction = span === undefined
    ? `x1="0" y1="0" x2="0" y2="1"`
    : `gradientUnits="userSpaceOnUse" x1="0" y1="${span.y1}" x2="0" y2="${span.y2}"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" ` +
    `height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<defs><linearGradient id="fill" ${direction}>` +
    `${stopsOf(gradient)}</linearGradient></defs>` +
    outlines.join("") + fills.join("") + "</svg>";
}
