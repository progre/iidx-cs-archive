// 曲中オーバーレイの場面animationの中身。使う枠ごとに640x480の場面を1本持ち、
// 絵のあるframeを表示長のまま並べる。原盤と同じく、spriteは等倍で焼いて項目の拡縮blockで
// 縦2倍にし、xはそのまま・yは2倍で画面座標へ写す。はみ出しはPBの切り抜きに任せる。

import { SKIRT } from "../legacy/mod.ts";
import type { OverlayFrame, OverlaySlot } from "./slots.ts";

/** legacyの絵は640x256の描画面にあり、TVでは縦2倍になる */
const SCALE_Y = 2;
const FULL = 100;
const SCENE_HEIGHT = 480;
const SCENE_WIDTH = 640;

/**
 * 小片に含める隣の画素の幅の候補。隣の画素を含めて切ると、小片の使い回しが減って
 * sheetが溢れる曲がある(7thの1曲)。溢れたら含めずに組み直し、DPの隙間はその曲だけ残す
 */
export const SKIRT_CANDIDATES: readonly number[] = [SKIRT, 0];

export interface OverlayScene {
  height: number;
  items: {
    endFrame: number;
    sprite: number;
    startFrame: number;
    x: number;
    y: number;
  }[];
  scaleX: number;
  scaleY: number;
  width: number;
}

/** 枠の場面。`placed`はframeの小片ごとの絵の添字で、`skirt`は小片に含めた隣の画素の幅 */
export function sceneOf(
  slot: OverlaySlot,
  placed: ReadonlyMap<OverlayFrame, readonly number[]>,
  skirt: number,
): OverlayScene {
  const items: OverlayScene["items"] = [];
  let startFrame = 0;
  for (const frame of slot.frames) {
    const endFrame = startFrame + frame.length;
    const indices = placed.get(frame);
    if (indices === undefined) throw new Error("焼いていないframeを置いている");
    // legacyは組の先が奥、PBは項目の末尾が奥。切り直した小片は隣の画素を含むので、
    // 置き場所はそのぶん戻す
    for (let i = frame.sprites.length - 1; i >= 0; i--) {
      const sprite = frame.sprites[i];
      items.push({
        endFrame,
        sprite: indices[i],
        startFrame,
        x: sprite.x - skirt,
        y: (sprite.y - skirt) * SCALE_Y,
      });
    }
    startFrame = endFrame;
  }
  return {
    height: SCENE_HEIGHT,
    items,
    scaleX: FULL,
    scaleY: FULL * SCALE_Y,
    width: SCENE_WIDTH,
  };
}

/**
 * 曲DBの枠の位置を保った場面animation番号。原盤と同じく場面は使う枠のぶんだけ持ち、
 * 番号は詰めて振るので、枠と場面は組が結ぶ。
 */
export function overlayPairs(
  slots: readonly OverlaySlot[],
  slotCount: number,
): (number | null)[] {
  const scene = new Map(slots.map((slot, at) => [slot.slot, at]));
  const pairs = Array.from(
    { length: slotCount },
    (_, at) => scene.get(at) ?? null,
  );
  while (pairs.length > 0 && pairs[pairs.length - 1] === null) pairs.pop();
  return pairs;
}
