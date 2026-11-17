// 同じ曲の別の版どうしで、譜面が同じかを比べる。
// 版によってテンポがわずかに違うので、tick の縮尺と位置を最小二乗でそろえてから比べる。

import type { ChartShape, ShapeComparison } from "@csa/core";

/** そろえた後の tick の差が、これ以内なら同じノーツとみなす */
const TICK_TOLERANCE = 6;
/** 縮尺がこれを超えて1から離れれば、BPM が違うので違う譜面とみなす */
const SCALE_TOLERANCE = 0.01;
/** そろえた後の tick の差が、これ以内なら時刻が一致したとみなす。tick の丸めの誤差である */
const ROUNDING_TOLERANCE = 1;

/** 鍵盤ごとに、同じ順番のノーツどうしを組にする。数が合わなければ null */
function pairsOf(a: ChartShape, b: ChartShape): [number, number][] | null {
  const keys = Object.keys(a.keys);
  if (keys.length !== Object.keys(b.keys).length) {
    return null;
  }
  const pairs: [number, number][] = [];
  for (const key of keys) {
    const x = a.keys[key];
    const y = b.keys[key];
    if (y === undefined || x.length !== y.length) {
      return null;
    }
    x.forEach((tick, i) => pairs.push([tick, y[i]]));
  }
  return pairs.length === 0 ? null : pairs;
}

const mean = (values: number[]) =>
  values.reduce((sum, v) => sum + v, 0) / values.length;

export function compareShape(a: ChartShape, b: ChartShape): ShapeComparison {
  const pairs = pairsOf(a, b);
  if (pairs === null) {
    return "layout";
  }
  // b の tick から a の tick を求める直線を、最小二乗で引く
  const ma = mean(pairs.map(([x]) => x));
  const mb = mean(pairs.map(([, y]) => y));
  const sbb = pairs.reduce((sum, [, y]) => sum + (y - mb) ** 2, 0);
  const sab = pairs.reduce((sum, [x, y]) => sum + (y - mb) * (x - ma), 0);
  const scale = sbb === 0 ? 1 : sab / sbb;
  if (Math.abs(scale - 1) > SCALE_TOLERANCE) {
    return "bpm";
  }
  const gaps = pairs.map(([x, y]) => Math.abs(x - (ma + (y - mb) * scale)));
  if (gaps.some((gap) => gap > TICK_TOLERANCE)) {
    return "layout";
  }
  return gaps.filter((gap) => gap <= ROUNDING_TOLERANCE).length / gaps.length;
}

export const sameShape = (a: ChartShape, b: ChartShape): boolean =>
  typeof compareShape(a, b) === "number";
