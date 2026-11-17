// era1の各曲に採用するムービーと切り出し矩形を決める。
// 本目は曲DBの欄の順。3rd/4th/5thは2本目(1:1版)、6thは2本目(`+0x28`の320x224)、
// 7th/8thは1本目を採り、6thの640x240(`D`)は曲のムービーでないので除く。
// 切り出しはパターンごとの標準帯(固定値)で、曲ごとの実測は使わない(圧縮ノイズで帯を内容と
// 誤認するため)。内容が横長(320x218)なら元が画素比1:1なので中央の正方形だけを採る。

import type { Crop, Era1Job, Era1Source } from "../types.ts";

const SECOND_SLOT_GENERATIONS = new Set(["3rd", "4th", "5th", "6th"]);

/** 作品 解像度 多重化レート(kbps) → 帯を除いた内容領域。7th/8thは多重化レートが新曲と旧曲を分ける */
const STANDARD_BANDS: Record<string, string> = {
  "3rd 192x256 6912": "176:236:8:0",
  "4th 192x224 6912": "176:214:8:4",
  "5th 192x224 6912": "176:214:8:4",
  "6th 320x224 6912": "320:218:0:2",
  "7th 192x224 4000": "176:216:8:0",
  "7th 192x224 6912": "176:214:8:4",
  "7th 320x224 6912": "320:218:0:2",
  "8th 192x224 4000": "176:216:8:0",
  "8th 192x224 6912": "176:214:8:4",
  "8th 320x224 6912": "320:218:0:2",
};

const parseCrop = (text: string): Crop => {
  const [w, h, x, y] = text.split(":").map(Number);
  return { h, w, x, y };
};

/** 標準帯。対応表に無い形式(640x240など)はundefined */
export function standardBand(
  generation: string,
  format: string,
): Crop | undefined {
  const text = STANDARD_BANDS[generation + " " + format];
  return text === undefined ? undefined : parseCrop(text);
}

/** 横長の内容領域だけ中央の正方形にする。縦長(192系)はそのまま240x240へ引き伸ばす */
export function squareCrop(band: Crop): Crop {
  if (band.w <= band.h) {
    return band;
  }
  return {
    h: band.h,
    w: band.h,
    x: band.x + Math.floor((band.w - band.h) / 2),
    y: band.y,
  };
}

/** 原盤のアーカイブと位置からjobを引くための名前。songmapのファイルとも突き合わせられる */
export const sourceKeyOf = (archive: string, offset: number): string =>
  archive.toUpperCase() + "@" + offset;

/** 作品とファイルの組から、解像度と多重化レートの表のキーを作る */
export const formatKeyOf = (generation: string, key: string): string =>
  generation + "_" + key;

/** 解像度と多重化レートを、標準帯の表と同じ書式の文字列にする */
export const formatOf = (
  head: { muxRateKbps: number; width: number; height: number },
): string => `${head.width}x${head.height} ${head.muxRateKbps}`;

/** formatsのキーは`formatKeyOf`、値は`formatOf`で作る。1世代分のjobを返す */
/** ELFからムービーを列挙し、原盤から形式の表を読んで、変換するムービーを決める */
export async function selectEra1Jobs(
  ports: {
    formatsOf: (source: Era1Source) => Promise<ReadonlyMap<string, string>>;
    sourceOf: () => Era1Source;
  },
  generation: string,
): Promise<Era1Job[]> {
  const source = ports.sourceOf();
  return selectEra1JobsOf(generation, source, await ports.formatsOf(source));
}

export function selectEra1JobsOf(
  generation: string,
  source: Era1Source,
  formats: ReadonlyMap<string, string>,
): Era1Job[] {
  const jobs: Era1Job[] = [];
  const videos = new Map(source.videos.map((video) => [video.key, video]));
  const chosen = new Map<string, number[]>();
  for (const song of source.songs) {
    if (song.videos.length === 0) {
      continue;
    }
    const key =
      SECOND_SLOT_GENERATIONS.has(generation) && song.videos.length > 1
        ? song.videos[1]
        : song.videos[0];
    chosen.set(key, [...(chosen.get(key) ?? []), song.id]);
  }
  for (const [key, songIds] of chosen) {
    const video = videos.get(key)!;
    const format = formats.get(formatKeyOf(generation, key));
    if (!format) {
      throw new Error(generation + " " + key + "の形式が無い");
    }
    const band = standardBand(generation, format);
    if (!band) {
      continue;
    }
    jobs.push({ band, crop: squareCrop(band), songIds, video });
  }
  return jobs;
}
