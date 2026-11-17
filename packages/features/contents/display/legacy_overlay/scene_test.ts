// 実行: deno test packages/features/contents/display/legacy_overlay/scene_test.ts
// 枠の位置を保つ場面番号と、場面の項目の並びを確かめる。

import { assertEquals, assertThrows } from "@std/assert";
import { legacyIfsSlice, overlayFileName } from "./elf_tile.ts";
import { overlayPairs, sceneOf } from "./scene.ts";
import {
  hasHoldFrame,
  isLostOverlay,
  type OverlayFrame,
  type OverlaySlot,
  withHoldFrames,
} from "./slots.ts";

const sprite = (x: number, y: number) => ({
  flag: 0,
  h: 16,
  selector: 0,
  set: 0,
  tile: 0,
  u: 0,
  v: 0,
  w: 16,
  x,
  y,
});

const slotAt = (slot: number, frames: OverlayFrame[] = []): OverlaySlot => ({
  animation: slot + 10,
  frames,
  slot,
});

Deno.test("場面は使う枠のぶんだけ詰めて振り、末尾の空枠は落とす", () => {
  assertEquals(overlayPairs([slotAt(1), slotAt(3)], 5), [null, 0, null, 1]);
  assertEquals(overlayPairs([], 5), []);
});

Deno.test("場面は組の先を奥にするため項目を逆順に並べ、隣の画素のぶん戻す", () => {
  const frame = { length: 3, sprites: [sprite(10, 4), sprite(20, 8)] };
  const scene = sceneOf(slotAt(0, [frame]), new Map([[frame, [5, 6]]]), 1);
  assertEquals(scene.items, [
    { endFrame: 3, sprite: 6, startFrame: 0, x: 19, y: 14 },
    { endFrame: 3, sprite: 5, startFrame: 0, x: 9, y: 6 },
  ]);
  assertEquals([scene.width, scene.height, scene.scaleY], [640, 480, 200]);
});

Deno.test("焼いていないframeを置こうとすると止まる", () => {
  const frame = { length: 1, sprites: [sprite(0, 0)] };
  assertThrows(() => sceneOf(slotAt(0, [frame]), new Map(), 0));
});

Deno.test("枠を作れなかった曲は、枠か IFs を持つときだけ失われたと数える", () => {
  const empty = (hasSlots: boolean) => ({ hasSlots, slots: [] });
  assertEquals(isLostOverlay(empty(false), false), false);
  assertEquals(isLostOverlay(empty(true), false), true);
  assertEquals(isLostOverlay(empty(false), true), true);
  assertEquals(
    isLostOverlay({ hasSlots: true, slots: [slotAt(0)] }, true),
    false,
  );
});

Deno.test("IFs が無い本は、ELFと組の名で本を識別する", () => {
  const slice = {
    sourceArchive: "ELF#a1-2",
    sourceFileIndex: 9,
    sourceOffset: 0,
    sourceSize: 1,
  };
  assertEquals(legacyIfsSlice(slice, "ELF"), null);
  assertEquals(legacyIfsSlice(slice, "OTHER")?.fileIndex, 9);
  assertEquals(overlayFileName(null, [slotAt(1), slotAt(2)]), "a11-12");
  assertEquals(overlayFileName(42, []), "0042");
});

Deno.test("表示長255の frame だけを、指定した長さにする", () => {
  const frames = [3, 255].map((length) => ({ length, sprites: [] }));
  const slots = [slotAt(1, frames), slotAt(2, frames.slice(0, 1))];
  assertEquals(hasHoldFrame(slots), true);
  assertEquals(hasHoldFrame(slots.slice(1)), false);
  assertEquals(
    withHoldFrames(slots, 26).map((slot) =>
      slot.frames.map((frame) => frame.length)
    ),
    [[3, 26], [3]],
  );
});
