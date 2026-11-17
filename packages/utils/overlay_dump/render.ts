// animationの1frameをjimpで合成する。位置・拡縮・不透明度・回転は、
// 隣り合う点の間を線形に補う。原盤の実データで裏取りするための描画で、精度は目視用。
// 合成1(黒い影)と2(加算)の扱いは推定で、実機との一致は未確認。

import type {
  Animation,
  AnimationItem,
  FramePoint,
  IfPackage,
} from "@csa/core";
import { decodeTexture8 } from "@csa/containers-if-container";
import { Buffer } from "node:buffer";
import { BlendMode, Jimp, ResizeStrategy } from "jimp";

type Image = InstanceType<typeof Jimp>;

const SHEET_STRIDE = 1024;

/** 点の列から、frameでの値を線形補間で求める。範囲外は端の値 */
function at<T extends FramePoint>(
  points: T[],
  frame: number,
  pick: (point: T) => number,
): number | undefined {
  if (points.length === 0) return undefined;
  const after = points.findIndex((point) => point.frame > frame);
  if (after === 0) return pick(points[0]);
  if (after < 0) return pick(points[points.length - 1]);
  const a = points[after - 1];
  const b = points[after];
  const t = (frame - a.frame) / (b.frame - a.frame);
  return pick(a) + (pick(b) - pick(a)) * t;
}

export class Renderer {
  private readonly sprites: Image[];

  constructor(
    private readonly pkg: IfPackage,
    private readonly animations: Animation[],
  ) {
    const sheets = pkg.metadata.sheets.map((sheet, i) =>
      Jimp.fromBitmap({
        data: Buffer.from(
          decodeTexture8(pkg.files[i + 1], sheet.width, sheet.height),
        ),
        height: sheet.height,
        width: sheet.width,
      })
    );
    this.sprites = pkg.metadata.sprites.map((sprite) => {
      const sheet = sheets[sprite.y >> 10];
      const y = sprite.y & (SHEET_STRIDE - 1);
      return sheet.clone().crop({ h: sprite.h, w: sprite.w, x: sprite.x, y });
    });
  }

  /** animationのframeを描く。画面はanimationの寸法で、透明で始める */
  render(index: number, frame: number): Image {
    const animation = this.animations[index];
    const canvas = new Jimp({
      color: 0x00000000,
      height: animation.height,
      width: animation.width,
    });
    // ファイル内の並びの末尾が奥
    for (const item of [...animation.items].reverse()) {
      if (frame < item.startFrame || frame >= item.endFrame) continue;
      if (item.kind === 3) continue;
      const source = this.sourceOf(item, frame);
      if (source === undefined) continue;
      this.composite(canvas, source, item, frame);
    }
    return canvas;
  }

  private sourceOf(item: AnimationItem, frame: number): Image | undefined {
    if (item.kind === 2) {
      if (item.target >= this.animations.length) return undefined;
      return this.render(
        item.target,
        frame - item.startFrame + item.frameOffset,
      );
    }
    return this.sprites[item.target]?.clone();
  }

  private composite(
    canvas: Image,
    source: Image,
    item: AnimationItem,
    frame: number,
  ): void {
    // jimpの変形は絵を書き換えて自身を返す
    const image = source;
    let anchorX = item.x;
    let anchorY = item.y;
    const scaleX = (at(item.zooms, frame, (p) => p.scaleX) ?? 100) / 100;
    const scaleY = (at(item.zooms, frame, (p) => p.scaleY) ?? 100) / 100;
    if (scaleX !== 1 || scaleY !== 1) {
      const w = Math.max(1, Math.round(image.width * Math.abs(scaleX)));
      const h = Math.max(1, Math.round(image.height * Math.abs(scaleY)));
      // 整数倍の拡大は行の複製になる。補間すると組み立てた絵を読み戻して照合できない
      image.resize({ h, mode: ResizeStrategy.NEAREST_NEIGHBOR, w });
      if (scaleX < 0) image.flip({ horizontal: true, vertical: false });
      if (scaleY < 0) image.flip({ horizontal: false, vertical: true });
      anchorX *= Math.abs(scaleX);
      anchorY *= Math.abs(scaleY);
    }
    const rotation = at(item.rotations, frame, (p) => p.rotation) ?? 0;
    if (rotation !== 0) {
      const before = { h: image.height, w: image.width };
      image.rotate(-rotation);
      anchorX += (image.width - before.w) / 2;
      anchorY += (image.height - before.h) / 2;
    }
    if (item.format === 1) silhouette(image);
    // 項目の不透明度欄はanimation参照でだけ効き、spriteの項目では0のまま置かれている
    const base = item.kind === 2 ? item.opacity : 100;
    const opacity = (at(item.fades, frame, (p) => p.opacity) ?? base) / 100;
    const x = (at(item.positions, frame, (p) => p.x) ?? 0) - anchorX;
    const y = (at(item.positions, frame, (p) => p.y) ?? 0) - anchorY;
    canvas.composite(image, Math.round(x), Math.round(y), {
      mode: item.format === 2 ? BlendMode.ADD : BlendMode.SRC_OVER,
      opacitySource: opacity,
    });
  }
}

/** 合成1。絵の形を黒で塗る */
function silhouette(image: Image): void {
  image.scan((_x, _y, idx) => {
    image.bitmap.data[idx] = 0;
    image.bitmap.data[idx + 1] = 0;
    image.bitmap.data[idx + 2] = 0;
  });
}
