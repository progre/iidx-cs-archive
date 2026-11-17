// 分けた本のmetadataの書き直しを、組み立てたmetadataで確かめる。
// sheet 3枚・sprite 6件・animation 3本を持ち、場面Aがsheet 0、場面Bがsheet 1と2を使う。

import type { IfPackage } from "@csa/core";
import { assertSplitReadable, rewriteSplitMetadata } from "./rewrite.ts";
import type { SceneUsage } from "./usage.ts";

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

function fixture(): IfPackage {
  const metadata = new Uint8Array(0x280);
  const dv = new DataView(metadata.buffer);
  dv.setUint16(2, 3, true);
  dv.setUint16(4, ANIMATIONS.length, true);
  dv.setUint16(6, SPRITES.length, true);
  dv.setUint32(8, SPRITE_TABLE, true);
  dv.setUint32(12, ANIMATION_TABLE, true);
  const sheets = [[64, 32], [48, 24], [32, 16]].map(([width, height]) => ({
    width,
    height,
  }));
  sheets.forEach(({ width, height }, sheet) => {
    dv.setUint16(0x10 + sheet * 4, width, true);
    dv.setUint16(0x12 + sheet * 4, height, true);
  });
  const sprites = SPRITES.map(([sheet, row], index) => {
    const at = SPRITE_TABLE + index * 8;
    const rect = { x: index * 4, y: (sheet << 10) | row, w: 8, h: 8 };
    dv.setUint16(at, rect.x, true);
    dv.setUint16(at + 2, rect.y, true);
    dv.setUint16(at + 4, rect.w, true);
    dv.setUint16(at + 6, rect.h, true);
    return rect;
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
  });
  return {
    files: [metadata],
    metadata: {
      animationCount: ANIMATIONS.length,
      animationsOffset: ANIMATION_TABLE,
      sheets,
      spriteInfoOffset: SPRITE_TABLE,
      sprites,
    },
    payloadEnd: 0,
  };
}

const sceneA: SceneUsage = {
  animations: new Set([0, 2]),
  sheets: new Set([0]),
  sprites: new Set([0, 1, 2]),
};
const sceneB: SceneUsage = {
  animations: new Set([1]),
  sheets: new Set([1, 2]),
  sprites: new Set([3, 4]),
};

/** 書き直したmetadataの項目を`種類/対象`の列にする。animationごとに`/`で区切る */
function itemsOf(metadata: Uint8Array): string {
  const dv = new DataView(metadata.buffer);
  return ANIMATIONS.map((animation) =>
    animation.items.map((_, at) => {
      const item = animation.at + at * ITEM_BYTES;
      return `${dv.getUint16(item, true)}/${dv.getUint16(item + 2, true)}`;
    }).join(" ")
  ).join(" / ");
}

Deno.test("使うsheetを振り直し、辿れない項目は潰す", () => {
  const a = rewriteSplitMetadata(fixture(), sceneA);
  assertEquals(a.sheets.join(), "0", "場面Aのsheet");
  assertEquals(itemsOf(a.metadata), "0/0 0/1 2/2 / 0/0 0/0 / 0/2", "項目");
  const b = rewriteSplitMetadata(fixture(), sceneB);
  assertEquals(b.sheets.join(), "1,2", "場面Bのsheet");
  assertEquals(itemsOf(b.metadata), "0/0 0/0 0/0 / 0/0 0/1 / 0/0", "項目");
});

Deno.test("spriteのyはsheet番号を振り直し、使わない表の行は0にする", () => {
  const { metadata } = rewriteSplitMetadata(fixture(), sceneB);
  const dv = new DataView(metadata.buffer);
  assertEquals(dv.getUint16(2, true), 2, "sheet数");
  assertEquals(dv.getUint16(6, true), 2, "sprite数");
  assertEquals(dv.getUint16(SPRITE_TABLE + 2, true), 0x10, "1件目のy");
  assertEquals(
    dv.getUint16(SPRITE_TABLE + 10, true),
    (1 << 10) | 0x20,
    "2件目",
  );
  assertEquals(dv.getUint16(SPRITE_TABLE + 16, true), 0, "使わない行");
});

Deno.test("sheet数とsprite数が合わない本は読み直せない", () => {
  const split = { sheets: [0], sprites: [0, 1, 2] };
  const written = fixture().metadata;
  let threw = false;
  try {
    assertSplitReadable(written, split);
  } catch {
    threw = true;
  }
  assertEquals(threw, true, "例外");
});
