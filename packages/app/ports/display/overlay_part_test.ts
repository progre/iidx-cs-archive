// 実行: deno test packages/app/ports/display/overlay_part_test.ts
// sheet 3枚・sprite 6件・animation 3本の`.if`を組み、場面Aがsheet 0、場面Bがsheet 1と2を
// 使う形で、辿りと組み直しを確かめる。分け方の選定は`@csa/layout-display-prepare`、
// metadataの書き直しは`contents-overlay`が単体で確かめる。ここは呼び出し順の結果を確かめる。

import {
  buildIfPackage,
  parseAnimations,
  parseIfPackage,
} from "@csa/containers-if-container";
import { sceneUsage, writeOverlayPart } from "@csa/contents-overlay";
import { splitPlanPorts } from "./lap.ts";

const ITEM_BYTES = 0x24;
const SPRITE_TABLE = 0x40;
const ANIMATION_TABLE = 0x100;
/** {sheet番号, sheet内の行} */
const SPRITES: [number, number][] = [
  [0, 0],
  [0, 0x40],
  [0, 0x80],
  [1, 0x10],
  [2, 0x20],
  [2, 0x30],
];
/** 場面A(0)はsprite 0・1と種類2で辿るanimation 2、場面B(1)はsprite 3・4を使う */
const ANIMATIONS: { at: number; items: [number, number][] }[] = [
  { at: 0x120, items: [[0, 0], [0, 1], [2, 2]] },
  { at: 0x1b0, items: [[0, 3], [0, 4]] },
  { at: 0x220, items: [[0, 2]] },
];

function assertEquals<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: ${String(actual)} != ${String(expected)}`);
  }
}

function fixture(): Uint8Array {
  const metadata = new Uint8Array(0x280);
  const dv = new DataView(metadata.buffer);
  dv.setUint16(2, 3, true);
  dv.setUint16(4, ANIMATIONS.length, true);
  dv.setUint16(6, SPRITES.length, true);
  dv.setUint32(8, SPRITE_TABLE, true);
  dv.setUint32(12, ANIMATION_TABLE, true);
  [[64, 32], [48, 24], [32, 16]].forEach(([width, height], sheet) => {
    dv.setUint16(0x10 + sheet * 4, width, true);
    dv.setUint16(0x12 + sheet * 4, height, true);
  });
  SPRITES.forEach(([sheet, row], index) => {
    const at = SPRITE_TABLE + index * 8;
    dv.setUint16(at, index * 4, true);
    dv.setUint16(at + 2, (sheet << 10) | row, true);
    dv.setUint16(at + 4, 8, true);
    dv.setUint16(at + 6, 8, true);
  });
  ANIMATIONS.forEach((animation, index) => {
    dv.setUint32(ANIMATION_TABLE + index * 4, animation.at, true);
    animation.items.forEach(([kind, target], at) => {
      const item = animation.at + at * ITEM_BYTES;
      dv.setUint16(item, kind, true);
      dv.setUint16(item + 2, target, true);
      dv.setUint16(item + 6, kind === 2 ? 100 : 0, true);
    });
    const end = animation.at + animation.items.length * ITEM_BYTES;
    dv.setUint16(end, 0xffff, true);
    dv.setUint16(end + 2, 0xffff, true);
    dv.setUint16(end + 0x10, 320, true);
    dv.setUint16(end + 0x12, 240, true);
  });
  return buildIfPackage([
    metadata,
    ...[1, 2, 3].map((n) => new Uint8Array(16).fill(n * 0x11)),
  ]);
}

const usageOf = (source: Uint8Array, scene: number) => {
  const pkg = parseIfPackage(source);
  return sceneUsage(pkg, parseAnimations(pkg.files[0]), [scene]);
};

const list = (values: Iterable<number>) =>
  [...values].sort((a, b) => a - b).join(" ");

Deno.test("場面から辿るanimationとsprite、使うsheetを集める", () => {
  const source = fixture();
  const sceneA = usageOf(source, 0);
  assertEquals(list(sceneA.animations), "0 2", "種類2で辿った先を含む");
  assertEquals(list(sceneA.sprites), "0 1 2", "sprite");
  assertEquals(list(sceneA.sheets), "0", "sheet");
  const sceneB = usageOf(source, 1);
  assertEquals(list(sceneB.sprites), "3 4", "sprite");
  assertEquals(list(sceneB.sheets), "1 2", "sheet");
});

function readPart(source: Uint8Array, scene: number) {
  const pkg = parseIfPackage(
    writeOverlayPart(splitPlanPorts, source, [scene]).bytes,
  );
  return {
    items: parseAnimations(pkg.files[0]).map((animation) =>
      animation.items.map((item) => `${item.kind}/${item.target}`).join(" ")
    ),
    sheets: pkg.metadata.sheets.map((sheet) => `${sheet.width}x${sheet.height}`)
      .join(" "),
    sprites: pkg.metadata.sprites.map((sprite) => sprite.y.toString(16)).join(
      " ",
    ),
  };
}

Deno.test("分けた本は使うsheetとspriteだけを持ち、辿れない項目は潰れる", () => {
  const source = fixture();
  const partA = readPart(source, 0);
  assertEquals(partA.sheets, "64x32", "sheet");
  assertEquals(partA.sprites, "0 40 80", "spriteのy");
  assertEquals(partA.items.join(" / "), "0/0 0/1 2/2 / 0/0 0/0 / 0/2", "項目");
  const partB = readPart(source, 1);
  assertEquals(partB.sheets, "48x24 32x16", "sheet");
  assertEquals(partB.sprites, "10 420", "spriteのyはsheet番号を振り直す");
  assertEquals(partB.items.join(" / "), "0/0 0/0 0/0 / 0/0 0/1 / 0/0", "項目");
});

Deno.test("分けた本のsheetは元の圧縮データをそのまま写す", () => {
  const source = fixture();
  const original = parseIfPackage(source);
  const pkg = parseIfPackage(
    writeOverlayPart(splitPlanPorts, source, [1]).bytes,
  );
  assertEquals(pkg.files.length, 3, "metadataと2枚");
  assertEquals(
    pkg.files[1].every((value, at) => value === original.files[2][at]),
    true,
    "1枚目は元のsheet 1",
  );
  assertEquals(pkg.files[2][0], original.files[3][0], "2枚目は元のsheet 2");
});
