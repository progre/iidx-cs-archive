// LZSSの往復、棚積み、画像セットの分割。合成した入力だけで確かめ、原盤は読まない。
// 実行: deno test packages/features/containers/if_container/image_set/pack_split_test.ts

import { decodeLzss, encodeLzss, parseIfPackage } from "../../format/mod.ts";
import { packSprites, splitImageSet } from "./pack_split.ts";
import { imageSetOf } from "../testing.ts";

function assertEquals<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: ${String(actual)} != ${String(expected)}`);
  }
}

Deno.test("LZSSは往復で一致し、擬似乱数と反復の両方を扱う", () => {
  const input = new Uint8Array(70000);
  let seed = 1;
  for (let i = 0; i < input.length; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    input[i] = i % 5000 < 3000 ? (seed >> 16) & 0xff : i & 0x0f;
  }
  const encoded = encodeLzss(input);
  const decoded = decodeLzss(encoded, input.length);
  assertEquals(decoded.length, input.length, "長さ");
  assertEquals(decoded.every((value, i) => value === input[i]), true, "内容");
  assertEquals(encoded.length < input.length, true, "圧縮されている");
});

Deno.test("棚積みは幅640を超えず、シート高さを64単位に丸める", () => {
  const result = packSprites([
    { w: 300, h: 40 },
    { w: 300, h: 40 },
    { w: 300, h: 40 },
    { w: 100, h: 20 },
  ]);
  assertEquals(result.sheetHeights.length, 1, "シート数");
  assertEquals(result.sheetHeights[0], 128, "シート高さ");
  for (const place of result.placements) {
    assertEquals(place.x + 300 <= 640 || place.x === 0, true, "幅");
  }
});

Deno.test("分割はシート数の上限で切り、spriteをシート番号に合わせて移す", () => {
  const pkg = imageSetOf(
    [
      { h: 4, w: 5, x: 1, y: 2 },
      { h: 6, w: 7, x: 3, y: 1024 + 8 },
      { h: 8, w: 9, x: 5, y: 2048 + 10 },
    ],
    [],
    undefined,
    3,
  );
  const split = splitImageSet(pkg, { byteLimit: Infinity, sheetLimit: 2 });
  assertEquals(split.parts.length, 2, "ファイル数");
  const rebuilt = split.parts.map(parseIfPackage);
  assertEquals(rebuilt[0].metadata.sheets.length, 2, "1本目のシート数");
  assertEquals(rebuilt[1].metadata.sheets.length, 1, "2本目のシート数");
  const moved = split.spriteMap.get(2)!;
  assertEquals(moved.part, 1, "3番目のspriteの移動先");
  const rect = rebuilt[moved.part].metadata.sprites[moved.sprite];
  assertEquals(JSON.stringify(rect), '{"h":8,"w":9,"x":5,"y":10}', "矩形");
});

Deno.test("分割は圧縮後の大きさの上限でも切る", () => {
  const pkg = imageSetOf([{ h: 1, w: 1, x: 0, y: 0 }], [], undefined, 3);
  const whole = splitImageSet(pkg, { byteLimit: Infinity, sheetLimit: 32 });
  assertEquals(whole.parts.length, 1, "上限なしでは1本");
  const byteLimit = whole.parts[0].length - 1;
  const split = splitImageSet(pkg, { byteLimit, sheetLimit: 32 });
  assertEquals(split.parts.length > 1, true, "大きさで分かれる");
  assertEquals(
    split.parts.every((part) => part.length <= byteLimit),
    true,
    "上限以下",
  );
});
