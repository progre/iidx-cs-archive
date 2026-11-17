// SVGの組み立て。画素化せず、文字列の中身で確かめる。
// 実行: deno test packages/features/contents/display/text_render/svg_test.ts

import { svgOf } from "./svg.ts";

function assertIncludes(actual: string, expected: string): void {
  if (!actual.includes(expected)) {
    throw new Error(`${expected} が含まれない: ${actual}`);
  }
}

/** 1pxがtransform前の2に当たる配置 */
const LAYOUT = {
  pathData: ["M0 0L1 1Z"],
  transform: "scale(0.5)",
  unit: 2,
  width: 10,
  height: 20,
};

/** 縁1px、ぼかし0.5px */
const LOOK = { outline: 1, outlineSoftness: 0.5, gradient: [] };

Deno.test("濃淡の色を位置の順に置く", () => {
  const svg = svgOf(LAYOUT, {
    ...LOOK,
    gradient: [
      { at: 0, color: "#fff" },
      { at: 0.75, color: "#888" },
      { at: 1, color: "#ccc" },
    ],
  });
  assertIncludes(
    svg,
    '<stop offset="0" stop-color="#fff"/><stop offset="0.75" stop-color="#888"/>' +
      '<stop offset="1" stop-color="#ccc"/>',
  );
});

Deno.test("縁は、ぼかした太い縁の上に、アンチエイリアスを切った縁を重ねる", () => {
  const svg = svgOf(LAYOUT, LOOK);
  // 縁1pxは線の幅2px、ぼかしの縁1.5pxは線の幅3pxで、1pxは2に当たる
  assertIncludes(svg, 'stroke-width="6" stroke-linejoin="round"/>');
  assertIncludes(
    svg,
    'stroke-width="4" stroke-linejoin="round" shape-rendering="crispEdges"/>',
  );
  if (svg.indexOf('stroke-width="6"') > svg.indexOf('stroke-width="4"')) {
    throw new Error("ぼかしの縁が後に描かれている");
  }
});

Deno.test("断片ごとに塗り、全部の縁を塗りより先に描く", () => {
  const svg = svgOf({ ...LAYOUT, pathData: ["M0 0Z", "M1 1Z"] }, LOOK);
  const order = [...svg.matchAll(/d="(M\d \dZ)"[^>]*fill="([^"]+)"/g)]
    .map((m) => m[1] + " " + m[2]);
  const expected = [
    "M0 0Z #000",
    "M1 1Z #000",
    "M0 0Z #000",
    "M1 1Z #000",
    "M0 0Z url(#fill)",
    "M1 1Z url(#fill)",
  ];
  if (order.join(",") !== expected.join(",")) {
    throw new Error(`描く順が違う: ${order.join(",")}`);
  }
});

Deno.test("濃淡の範囲があれば、その範囲で縦の濃淡を掛ける", () => {
  const svg = svgOf({ ...LAYOUT, gradientSpan: { y1: -75, y2: 25 } }, LOOK);
  assertIncludes(
    svg,
    `<linearGradient id="fill" gradientUnits="userSpaceOnUse" x1="0" y1="-75" x2="0" y2="25">`,
  );
});
