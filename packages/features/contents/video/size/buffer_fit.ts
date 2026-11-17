// PBのムービー初期化は曲DB`+0x62` bit1で2種類のバッファを選ぶ。
// 判定は解像度の一致ではなくバッファに収まるかで行う。PB原盤自身がVANESSAの304x416を
// 480x480バッファで再生しており、一致で見ると置けなくなる。

import type { Resolution } from "@csa/core";

// ムービーの、末尾のゼロを除いた長さ。
// 原盤のムービーは、末尾をゼロで埋めてセクターに揃えてある。埋める長さは世代ごとに違うので、
// 中身が同じムービーでもファイルの大きさが違う。中身を見比べるときは、この長さを使う。

/** 一度に読む末尾の長さ。埋めたゼロは1セクターに収まるので、たいていは1回で済む */
const TAIL_CHUNK = 64 * 1024;

/** `readAt`は、ムービーの先頭からの位置と長さを受け取って、そのバイト列を返す */
export async function contentLength(
  size: number,
  readAt: (offset: number, length: number) => Promise<Uint8Array>,
): Promise<number> {
  let end = size;
  while (end > 0) {
    const start = Math.max(0, end - TAIL_CHUNK);
    const bytes = await readAt(start, end - start);
    const last = bytes.findLastIndex((byte) => byte !== 0);
    if (last >= 0) {
      return start + last + 1;
    }
    end = start;
  }
  return 0;
}

const SMALL_BUFFER = 240;
const LARGE_BUFFER = 480;

const fits = (resolution: Resolution, side: number) =>
  resolution.width <= side && resolution.height <= side;

/** 曲DB`+0x62` bit1を立てるか。小さいバッファに収まらない解像度で立てる */
export const needsLargeBuffer = (resolution: Resolution): boolean =>
  !fits(resolution, SMALL_BUFFER);

/** 原盤のまま置けるか。どちらのバッファにも収まらない解像度は置けない */
export const fitsAnyBuffer = (resolution: Resolution): boolean =>
  fits(resolution, LARGE_BUFFER);
