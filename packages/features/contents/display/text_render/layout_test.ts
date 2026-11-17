// 文字の配置。フォントを読まず、1文字を長方形の輪郭にする偽のフォントで確かめる。
// 実行: deno test packages/features/contents/display/text_render/layout_test.ts

import type { GlyphFont } from "./font.ts";
import { layoutText } from "./layout.ts";
import type { TextStyle } from "./style.ts";

function assertEquals<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: ${String(actual)} != ${String(expected)}`);
  }
}

/** 1文字を幅0.5、基準線の上0.8・下0.2の長方形にする */
const FAKE_FONT: GlyphFont = {
  getPath(text, x, y, size) {
    const w = text.length * size * 0.5;
    const top = y - size * 0.8;
    const bottom = y + size * 0.2;
    return {
      commands: [
        { type: "M", x, y: top },
        { type: "L", x: x + w, y: bottom },
        { type: "Z" },
      ],
      getBoundingBox: () => ({ x1: x, y1: top, x2: x + w, y2: bottom }),
    };
  },
  getAdvanceWidth: (text, size) => text.length * size * 0.5,
};

/** 偽のフォントのHは高さ100なので、倍率は0.2になる */
const STYLE: TextStyle = {
  font: "",
  capHeight: 20,
  outline: 1,
  outlineSoftness: 0.5,
  gradient: [],
  subtitleScale: 0.5,
  widthScale: 1,
  letterSpacing: 0,
  offsetY: 0,
  maxWidth: 1000,
  maxHeight: 1000,
};

/** 縁1pxにぼかし0.5pxを足した余白 */
const MARGIN = 1.5;

Deno.test("キャップハイトで大きさを決め、縁とぼかしの分を足した大きさにする", () => {
  const layout = layoutText(FAKE_FONT, [{ text: "AB" }], STYLE);
  // 幅100と高さ100は倍率0.2で20になり、余白の3を足す
  assertEquals(layout.width, 23, "幅");
  assertEquals(layout.height, 23, "高さ");
  assertEquals(
    layout.transform,
    `translate(${MARGIN} ${MARGIN}) scale(0.2) translate(0 80)`,
    "変換",
  );
  assertEquals(layout.unit, 5, "1pxに当たる長さ");
});

Deno.test("offsetYの分だけ文字を下げ、画像の高さを足す", () => {
  const layout = layoutText(FAKE_FONT, [{ text: "AB" }], {
    ...STYLE,
    offsetY: 1,
  });
  assertEquals(layout.height, 24, "高さ");
  assertEquals(
    layout.transform,
    `translate(${MARGIN} ${MARGIN + 1}) scale(0.2) translate(0 80)`,
    "変換",
  );
});

Deno.test("横はwidthScaleの割合で座標に掛ける", () => {
  const style = { ...STYLE, widthScale: 0.5 };
  const layout = layoutText(FAKE_FONT, [{ text: "AB" }], style);
  assertEquals(layout.width, 13, "幅");
  assertEquals(
    layout.pathData.join("|"),
    "M0 -80L25 20ZM25 -80L50 20Z",
    "輪郭",
  );
  assertEquals(layout.unit, 5, "1pxに当たる長さ");
});

Deno.test("letterSpacingの割合だけ字の間を詰める", () => {
  const style = { ...STYLE, letterSpacing: -0.1 };
  const layout = layoutText(FAKE_FONT, [{ text: "AB" }], style);
  // Bは送り幅50から大きさ100の1割を詰めた40に置き、幅は90になる
  assertEquals(
    layout.pathData.join("|"),
    "M0 -80L50 20ZM40 -80L90 20Z",
    "輪郭",
  );
  assertEquals(layout.width, 21, "幅");
});

Deno.test("副題は小さく描き、本題に続けて同じ基準線に置く", () => {
  const layout = layoutText(
    FAKE_FONT,
    [{ text: "A" }, { text: "B", subtitle: true }],
    STYLE,
  );
  // 本題は送り幅50の後に、副題を大きさ50で基準線0に置く
  assertEquals(
    layout.pathData.join("|"),
    "M0 -80L50 20Z|M50 -40L75 10Z",
    "断片ごとの輪郭",
  );
});

Deno.test("幅が上限を超えたら、高さを保って横だけ縮める", () => {
  const style = { ...STYLE, maxWidth: 13 };
  const layout = layoutText(FAKE_FONT, [{ text: "AB" }], style);
  // 幅20を、余白の3を除いた10へ収めるので、横の倍率は0.5になる
  assertEquals(layout.width, 13, "幅");
  assertEquals(layout.height, 23, "高さ");
  assertEquals(
    layout.pathData.join("|"),
    "M0 -80L25 20ZM25 -80L50 20Z",
    "輪郭",
  );
});

Deno.test("高さが上限を超えたら、縦横同じ割合で縮める", () => {
  const style = { ...STYLE, maxHeight: 13 };
  const layout = layoutText(FAKE_FONT, [{ text: "AB" }], style);
  // 高さ100を、余白の3を除いた10へ収めるので、倍率は0.1になる
  assertEquals(layout.height, 13, "高さ");
  assertEquals(layout.width, 13, "幅");
  assertEquals(layout.unit, 10, "1pxに当たる長さ");
});

Deno.test("baselineがあれば、画像の高さを上限に固定し、基準線をその位置に置く", () => {
  // 字の高さ20に余白3を足すと上限の20を超えるが、縮めない
  const style = { ...STYLE, maxHeight: 20, baseline: 15 };
  const layout = layoutText(FAKE_FONT, [{ text: "AB" }], style);
  assertEquals(layout.height, 20, "高さ");
  assertEquals(layout.unit, 5, "1pxに当たる長さ");
  assertEquals(
    layout.transform,
    `translate(${MARGIN} 15) scale(0.2) translate(0 0)`,
    "変換",
  );
  // 濃淡は画像の上端から下端までで、変換の前の長さで表す
  assertEquals(layout.gradientSpan?.y1, -75, "濃淡の上端");
  assertEquals(layout.gradientSpan?.y2, 25, "濃淡の下端");
});
