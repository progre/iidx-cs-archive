// metadata(file 0)のanimation表。1本のanimationは0x24バイトの項目の列で、
// 終端の項目(kind 0xffff)が画面の大きさと再生範囲を持つ。
// 項目はspriteかanimationを指し、frameごとの位置・拡縮・不透明度・回転を
// `ff ff 00 00`終端の可変長blockで持つ。構造は原盤の実データで裏取りしたもの。

import type {
  Animation,
  AnimationItem,
  AnimationItemKind,
  IfPackage,
} from "@csa/core";
import { compressedLengths, parseIfPackage } from "./container.ts";

const ITEM_BYTES = 0x24;
const END_FRAME = 0xffff;

function i16(dv: DataView, offset: number): number {
  return dv.getInt16(offset, true);
}

function readBlock<T>(
  dv: DataView,
  offset: number,
  stride: number,
  point: (at: number) => T,
): T[] {
  if (offset === 0 || offset === 0xffff) return [];
  const points: T[] = [];
  for (let at = offset; dv.getUint32(at, true) !== 0xffff; at += stride) {
    points.push(point(at));
  }
  return points;
}

function readItem(dv: DataView, at: number): AnimationItem {
  const kind = dv.getUint16(at, true);
  if (kind > 3) throw new Error(`animation項目の種類${kind}は未定義`);
  const opacity = dv.getUint16(at + 6, true);
  return {
    endFrame: dv.getUint16(at + 10, true),
    fades: readBlock(dv, dv.getUint32(at + 0x1c, true), 4, (p) => ({
      frame: i16(dv, p),
      opacity: Math.abs(dv.getInt8(p + 2)),
      opacity2: Math.abs(dv.getInt8(p + 3)),
    })),
    frameOffset: dv.getUint32(at + 12, true),
    format: dv.getUint16(at + 4, true),
    kind: kind as AnimationItemKind,
    opacity: Math.min(opacity, 100),
    positions: readBlock(dv, dv.getUint32(at + 0x14, true), 8, (p) => ({
      frame: i16(dv, p),
      x: i16(dv, p + 2),
      y: i16(dv, p + 4),
    })),
    rotations: readBlock(dv, dv.getUint32(at + 0x20, true), 4, (p) => ({
      frame: i16(dv, p),
      rotation: i16(dv, p + 2),
    })),
    startFrame: dv.getUint16(at + 8, true),
    target: dv.getUint16(at + 2, true),
    x: dv.getUint16(at + 0x10, true),
    y: dv.getUint16(at + 0x12, true),
    zooms: readBlock(dv, dv.getUint32(at + 0x18, true), 8, (p) => ({
      frame: i16(dv, p),
      scaleX: i16(dv, p + 2),
      scaleY: i16(dv, p + 4),
    })),
  };
}

function readAnimation(dv: DataView, offset: number): Animation {
  const items: AnimationItem[] = [];
  let at = offset;
  for (; dv.getUint16(at + 2, true) !== END_FRAME; at += ITEM_BYTES) {
    items.push(readItem(dv, at));
  }
  if (dv.getUint16(at, true) !== END_FRAME) {
    throw new Error("animationの終端項目の種類が0xffffでない");
  }
  const endFrame = Math.max(
    dv.getUint16(at + 10, true),
    ...items.map((item) => item.endFrame),
  );
  return {
    endFrame,
    height: dv.getUint16(at + 0x12, true) * 2,
    items,
    startFrame: dv.getUint16(at + 8, true),
    width: dv.getUint16(at + 0x10, true) * 2,
  };
}

/** metadata(file 0)から全animationを読む */
export function parseAnimations(metadata: Uint8Array): Animation[] {
  const dv = new DataView(
    metadata.buffer,
    metadata.byteOffset,
    metadata.byteLength,
  );
  const count = dv.getUint16(4, true);
  const table = dv.getUint32(12, true);
  return Array.from(
    { length: count },
    (_, i) => readAnimation(dv, dv.getUint32(table + i * 4, true)),
  );
}

/** 圧縮前のfileと、animation表と、記述子の圧縮長 */
export interface ParsedIfAnimations {
  animations: Animation[];
  /** 記述子の圧縮長。metadataが先頭で、以降がtextureの順に並ぶ */
  compressed: number[];
  pkg: IfPackage;
}

/** 曲中オーバーレイの`.if`を、分割の計画が要る形に読む */
export function parseIfWithAnimations(bytes: Uint8Array): ParsedIfAnimations {
  const pkg = parseIfPackage(bytes);
  return {
    animations: parseAnimations(pkg.files[0]),
    compressed: compressedLengths(bytes),
    pkg,
  };
}
