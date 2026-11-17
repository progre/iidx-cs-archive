// resample.ts の検査。合成した小さな画像だけで見る。

import { type Raster, resampleToFrame } from "./resample.ts";

function assertEquals<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: ${String(actual)} != ${String(expected)}`);
  }
}

function solid(
  width: number,
  height: number,
  color: [number, number, number, number],
): Raster {
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    rgba.set(color, i * 4);
  }
  return { height, rgba, width };
}

const pixel = (
  image: Raster,
  x: number,
  y: number,
) => [...image.rgba.subarray((y * image.width + x) * 4).subarray(0, 4)];

Deno.test("枠より大きい画像の出力は枠の大きさになる", () => {
  const out = resampleToFrame(solid(8, 6, [200, 100, 50, 255]), 1, 2, {
    h: 10,
    w: 6,
  });
  assertEquals(out.width, 6, "幅");
  assertEquals(out.height, 10, "高さ");
  assertEquals(out.rgba.length, 6 * 10 * 4, "バイト数");
  assertEquals(pixel(out, 3, 5).join(), "200,100,50,255", "中央の色");
});

Deno.test("枠より小さければ、足りない所は不透明な黒になる", () => {
  const out = resampleToFrame(solid(4, 4, [255, 255, 255, 255]), 1, 1, {
    h: 8,
    w: 8,
  });
  assertEquals(pixel(out, 0, 0).join(), "0,0,0,255", "左上の背景");
  assertEquals(pixel(out, 7, 7).join(), "0,0,0,255", "右下の背景");
  assertEquals(pixel(out, 4, 4).join(), "255,255,255,255", "絵の内側");
});

Deno.test("透明な画素は不透明な黒になる", () => {
  const out = resampleToFrame(solid(4, 4, [255, 0, 0, 0]), 1, 1, {
    h: 4,
    w: 4,
  });
  assertEquals(pixel(out, 1, 1).join(), "0,0,0,255", "透明は黒");
});
