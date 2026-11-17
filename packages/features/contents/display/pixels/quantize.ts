// legacyの絵を8bppの色表へ落とす。index 0は透過に充てる。
// 縮小で中間色が増えるので、色数が余る場合はメディアンカットでまとめる。
// 色表のバイト列への並べ方は、コンテナー側が決める。

import type { Image } from "@csa/core";

/** index 0を透過に使うので、絵に使えるのは255色 */
const MAX_COLORS = 255;
const CHANNELS = 4;

export interface Quantized {
  /** 色の並び。i番目の色のindexはi+1である。成分はRGBAで、どれも0..255 */
  colors: number[][];
  /** 色 → 色表のindex(1..255)。透過の画素は0 */
  indexOf: Map<number, number>;
}

/** RGBAを1つのu32鍵にまとめる。並びはr, g, b, aの順 */
export const colorKey = (rgba: Uint8Array, at: number): number =>
  (rgba[at] << 24 | rgba[at + 1] << 16 | rgba[at + 2] << 8 | rgba[at + 3]) >>>
  0;

/** 不透明な画素の色ごとの画素数。絵が複数なら合算する */
export function countColors(images: readonly Image[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const image of images) {
    for (let i = 0; i < image.width * image.height; i++) {
      if (image.rgba[i * 4 + 3] === 0) continue;
      const key = colorKey(image.rgba, i * 4);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

const channelOf = (key: number, k: number) => (key >>> (24 - k * 8)) & 0xff;

interface Box {
  keys: number[];
  weights: number[];
}

function widestChannel(box: Box): { channel: number; range: number } {
  let best = { channel: 0, range: -1 };
  for (let k = 0; k < CHANNELS; k++) {
    let low = 255;
    let high = 0;
    for (const key of box.keys) {
      const value = channelOf(key, k);
      low = Math.min(low, value);
      high = Math.max(high, value);
    }
    if (high - low > best.range) best = { channel: k, range: high - low };
  }
  return best;
}

/** 画素数の中央で二分する。片方が空にならないよう最低1色は残す */
function split(box: Box, channel: number): Box[] {
  const order = box.keys.map((key, i) => ({ key, weight: box.weights[i] }))
    .sort((a, b) => channelOf(a.key, channel) - channelOf(b.key, channel));
  const total = order.reduce((n, o) => n + o.weight, 0);
  let seen = 0;
  let cut = 0;
  for (let i = 0; i < order.length - 1; i++) {
    seen += order[i].weight;
    cut = i + 1;
    if (seen * 2 >= total) break;
  }
  return [order.slice(0, cut), order.slice(cut)].map((part) => ({
    keys: part.map((o) => o.key),
    weights: part.map((o) => o.weight),
  }));
}

/** 箱の代表色。画素数で重み付けした平均 */
function average(box: Box): number[] {
  const total = box.weights.reduce((n, w) => n + w, 0);
  return Array.from({ length: CHANNELS }, (_, k) =>
    Math.round(
      box.keys.reduce(
        (n, key, i) => n + channelOf(key, k) * box.weights[i],
        0,
      ) /
        total,
    ));
}

/**
 * 色ごとの画素数からCLUTを組む。255色に収まればそのまま、超えたら箱を分けて丸める。
 * 分ける箱は色の幅が最も広いものから選ぶ。
 */
export function quantize(counts: Map<number, number>): Quantized {
  let boxes: Box[] = [{
    keys: [...counts.keys()],
    weights: [...counts.values()],
  }];
  while (boxes.length < MAX_COLORS) {
    const widest = boxes
      .map((box, index) => ({ index, ...widestChannel(box) }))
      .filter((b) => boxes[b.index].keys.length > 1)
      .sort((a, b) => b.range - a.range)
      .at(0);
    if (widest === undefined || widest.range === 0) break;
    boxes = boxes.flatMap((box, index) =>
      index === widest.index ? split(box, widest.channel) : [box]
    );
  }
  const indexOf = new Map<number, number>();
  const colors = boxes.map((box, i) => {
    for (const key of box.keys) {
      indexOf.set(key, i + 1);
    }
    return average(box);
  });
  return { colors, indexOf };
}
