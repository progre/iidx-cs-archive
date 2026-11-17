// spriteを並べただけの場面animationを持つmetadata(file 0)を組む。読み側は
// container.ts と animation.ts。原盤の場面に倣い、項目は基準位置をspriteの中心に置き、
// 位置と拡縮のblockを開始と終了の2点で持つ。不透明度・回転のblockは持たない。

import type { IfSheet, IfSprite } from "@csa/core";

const ITEM_BYTES = 0x24;
/** 終端の項目と、点blockの終わりを表す値 */
const END = 0xffff;
const FULL = 100;
const POINT_BYTES = 8;
/** 位置は開始・終了の2点、拡縮は開始の1点。原盤の場面に倣う。どちらも終端が付く */
const POSITION_POINTS = 3;
const ZOOM_POINTS = 2;
/** 原盤の全パッケージでsprite表は0xD0から始まる */
const SPRITE_TABLE_OFFSET = 0xd0;

const align16 = (at: number) => (at + 15) & ~15;

export interface SceneItem {
  endFrame: number;
  /** sprite表の添字 */
  sprite: number;
  startFrame: number;
  /** 画面左上を原点とする、拡縮した後の置き場所 */
  x: number;
  y: number;
}

export interface Scene {
  height: number;
  /** 先頭が手前。読み側は末尾から描く */
  items: readonly SceneItem[];
  /** 百分率。100なら拡縮blockを持たない */
  scaleX: number;
  scaleY: number;
  width: number;
}

const zoomed = (scene: Scene) => scene.scaleX !== FULL || scene.scaleY !== FULL;
/** 1項目が持つ点blockの大きさ */
const blockBytesOf = (scene: Scene) =>
  (POSITION_POINTS + (zoomed(scene) ? ZOOM_POINTS : 0)) * POINT_BYTES;

interface Layout {
  scenes: number[];
  spriteTable: number;
  table: number;
  total: number;
}

function layoutOf(
  sheets: readonly IfSheet[],
  sprites: readonly IfSprite[],
  scenes: readonly Scene[],
): Layout {
  const spriteTable = Math.max(
    SPRITE_TABLE_OFFSET,
    align16(0x10 + sheets.length * 4),
  );
  let at = align16(spriteTable + sprites.length * 8);
  const offsets: number[] = [];
  for (const scene of scenes) {
    offsets.push(at);
    at += (scene.items.length + 1) * ITEM_BYTES +
      scene.items.length * blockBytesOf(scene);
  }
  const table = align16(at);
  return {
    scenes: offsets,
    spriteTable,
    table,
    total: align16(table + scenes.length * 4),
  };
}

/** どの点も同じ値を持つ点blockを書く。読み側は点の間を線形に補う */
function writeBlock(
  dv: DataView,
  at: number,
  frames: readonly number[],
  first: number,
  second: number,
): void {
  frames.forEach((frame, n) => {
    dv.setInt16(at + n * POINT_BYTES, frame, true);
    dv.setInt16(at + n * POINT_BYTES + 2, first, true);
    dv.setInt16(at + n * POINT_BYTES + 4, second, true);
  });
  dv.setUint16(at + frames.length * POINT_BYTES, END, true);
}

/** 項目1件と、その点blockを書く */
function writeItem(
  dv: DataView,
  at: number,
  block: number,
  scene: Scene,
  index: number,
  rect: IfSprite,
): void {
  const item = scene.items[index];
  const anchorX = rect.w >> 1;
  const anchorY = rect.h >> 1;
  dv.setUint16(at + 2, item.sprite, true);
  dv.setUint16(at + 6, FULL, true);
  dv.setUint16(at + 8, item.startFrame, true);
  dv.setUint16(at + 10, item.endFrame, true);
  dv.setUint16(at + 0x10, anchorX, true);
  dv.setUint16(at + 0x12, anchorY, true);
  dv.setUint32(at + 0x14, block, true);
  // 読み側は基準位置を倍率で伸ばしてから引くので、置き場所にも同じ倍率を掛ける
  writeBlock(
    dv,
    block,
    [item.startFrame, item.endFrame],
    item.x + Math.round(anchorX * scene.scaleX / FULL),
    item.y + Math.round(anchorY * scene.scaleY / FULL),
  );
  if (!zoomed(scene)) return;
  const zoom = block + POSITION_POINTS * POINT_BYTES;
  dv.setUint32(at + 0x18, zoom, true);
  writeBlock(dv, zoom, [item.startFrame], scene.scaleX, scene.scaleY);
}

/** 終端の項目。画面の大きさは基準位置の2倍で、再生範囲もここが持つ */
function writeEnd(dv: DataView, at: number, scene: Scene): void {
  dv.setUint16(at, END, true);
  dv.setUint16(at + 2, END, true);
  dv.setUint16(at + 6, END, true);
  dv.setUint16(
    at + 10,
    Math.max(0, ...scene.items.map((item) => item.endFrame)),
    true,
  );
  dv.setUint16(at + 0x10, scene.width >> 1, true);
  dv.setUint16(at + 0x12, scene.height >> 1, true);
}

export function buildSceneMetadata(
  sheets: readonly IfSheet[],
  sprites: readonly IfSprite[],
  scenes: readonly Scene[],
): Uint8Array {
  const layout = layoutOf(sheets, sprites, scenes);
  const out = new Uint8Array(layout.total);
  const dv = new DataView(out.buffer);
  dv.setUint16(2, sheets.length, true);
  dv.setUint16(4, scenes.length, true);
  dv.setUint16(6, sprites.length, true);
  dv.setUint32(8, layout.spriteTable, true);
  dv.setUint32(12, layout.table, true);
  sheets.forEach((sheet, i) => {
    dv.setUint16(0x10 + i * 4, sheet.width, true);
    dv.setUint16(0x10 + i * 4 + 2, sheet.height, true);
  });
  sprites.forEach((sprite, i) => {
    const at = layout.spriteTable + i * 8;
    dv.setUint16(at, sprite.x, true);
    dv.setUint16(at + 2, sprite.y, true);
    dv.setUint16(at + 4, sprite.w, true);
    dv.setUint16(at + 6, sprite.h, true);
  });
  scenes.forEach((scene, n) => {
    const start = layout.scenes[n];
    const blocks = start + (scene.items.length + 1) * ITEM_BYTES;
    const stride = blockBytesOf(scene);
    scene.items.forEach((item, i) => {
      const rect = sprites[item.sprite];
      if (rect === undefined) {
        throw new Error(`sprite ${item.sprite}が表に無い`);
      }
      writeItem(
        dv,
        start + i * ITEM_BYTES,
        blocks + i * stride,
        scene,
        i,
        rect,
      );
    });
    writeEnd(dv, start + scene.items.length * ITEM_BYTES, scene);
    dv.setUint32(layout.table + n * 4, start, true);
  });
  return out;
}
