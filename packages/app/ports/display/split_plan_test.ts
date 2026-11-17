// 実行: deno test packages/app/ports/display/split_plan_test.ts
// sheet 2枚・sprite 2件・animation 2本の合成`.if`で、分けた本の並びと大きさを確かめる。
// 分け方の選定は`@csa/layout-display-prepare`、本の中身の組み直しは`overlay_part_test.ts`が確かめる。

import type { OverLimitPackage } from "@csa/core";
import { assertEquals } from "@std/assert";
import { buildIfPackage, SECTOR_BYTES } from "@csa/containers-if-container";
import { partPathOf, planSplitParts } from "@csa/contents-overlay";
import { splitPlanPorts } from "./lap.ts";

const ITEM_BYTES = 0x24;
const SPRITE_TABLE = 0x40;
const ANIMATION_TABLE = 0x100;

/** 場面0がsprite 0(sheet 0)、場面1がsprite 1(sheet 1)を使う */
function fixture(): Uint8Array {
  const metadata = new Uint8Array(0x280);
  const dv = new DataView(metadata.buffer);
  dv.setUint16(2, 2, true);
  dv.setUint16(4, 2, true);
  dv.setUint16(6, 2, true);
  dv.setUint32(8, SPRITE_TABLE, true);
  dv.setUint32(12, ANIMATION_TABLE, true);
  [[64, 32], [48, 24]].forEach(([width, height], sheet) => {
    dv.setUint16(0x10 + sheet * 4, width, true);
    dv.setUint16(0x12 + sheet * 4, height, true);
  });
  [0, 1].forEach((sheet) => {
    const at = SPRITE_TABLE + sheet * 8;
    dv.setUint16(at + 2, sheet << 10, true);
    dv.setUint16(at + 4, 8, true);
    dv.setUint16(at + 6, 8, true);
  });
  [0x120, 0x1b0].forEach((animationAt, index) => {
    dv.setUint32(ANIMATION_TABLE + index * 4, animationAt, true);
    dv.setUint16(animationAt + 2, index, true);
    const end = animationAt + ITEM_BYTES;
    dv.setUint16(end, 0xffff, true);
    dv.setUint16(end + 2, 0xffff, true);
    dv.setUint16(end + 0x10, 320, true);
    dv.setUint16(end + 0x12, 240, true);
  });
  return buildIfPackage([
    metadata,
    ...[1, 2].map((n) => new Uint8Array(16).fill(n * 0x11)),
  ]);
}

const sourceOf = (scenes: number[], budget: number): OverLimitPackage => ({
  budget,
  generation: "9th",
  item: {} as OverLimitPackage["item"],
  scenes: new Set(scenes),
});

Deno.test("分けた本の名前は、元の連番と本の番号を続ける", () => {
  assertEquals(
    partPathOf(splitPlanPorts, "d/9th/overlays", 5, 2),
    "d/9th/overlays/0005_2.if",
  );
});

Deno.test("分けた本はセクターの境界まで埋め、全場面をどれかの本が持つ", () => {
  const parts = planSplitParts(splitPlanPorts, sourceOf([0, 1], 2), fixture());
  assertEquals(parts.length > 0, true);
  parts.forEach((part) => assertEquals(part.bytes.length % SECTOR_BYTES, 0));
  assertEquals(
    parts.flatMap((part) => part.animations).sort(),
    [0, 1],
  );
});
