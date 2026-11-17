// 3rd〜8thの譜面が鳴らすキー音バンクを、素材世代の曲DBエントリから決める。
// 素材世代のローダーと同じ引き方をする。

import type { ChartLayout } from "@csa/core";

const RANKS = ["another", "beginner", "hyper", "normal"] as const;
type Rank = typeof RANKS[number];

function fail(message: string): never {
  throw new Error(message);
}

/** キー音のオフセット。どれもSP・DPの順にs16が2つ並ぶ */
export interface KeysoundLayout {
  /** 難易度のフィールドが無いか、その値が正でないときに読む */
  hyper: number;
  another?: number;
  beginner?: number;
  normal?: number;
  /** archive番号(u8)。無い世代はキー音の値がそのままfile index */
  archiveOffset?: number;
}

/**
 * 世代の定義から、難易度ごとのキー音のオフセットを求める。`chartSlots`はその世代の譜面の並びである。
 * キー音とBGMの組は`[0,2] [1,3] [4,6] [5,7] …`と並ぶので、
 * SPの譜面スロット`2n`のキー音は、音の並びの`4n`番目である。音の並びに収まらない難易度は持たない
 */
export function keysoundLayoutOf(
  chart: ChartLayout,
  chartSlots: readonly string[],
): KeysoundLayout {
  const offsetOf = (rank: Rank) => {
    const slot = chartSlots.indexOf(`sp_${rank}`);
    const index = slot * 2;
    return slot < 0 || index >= chart.sounds.count
      ? undefined
      : chart.sounds.offset + index * 2;
  };
  const ranks = Object.fromEntries(
    RANKS.flatMap((rank) => {
      const offset = offsetOf(rank);
      return offset === undefined ? [] : [[rank, offset]];
    }),
  );
  return {
    ...ranks,
    hyper: offsetOf("hyper") ?? fail("HYPERのキー音が音の並びに無い"),
    ...(chart.keysoundArchiveOffset === null
      ? {}
      : { archiveOffset: chart.keysoundArchiveOffset }),
  };
}

function parseDifficulty(difficulty: string): { dp: boolean; rank: Rank } {
  const [style, rank] = difficulty.split("_");
  if (style !== "sp" && style !== "dp") fail(`難易度の側が無い: ${difficulty}`);
  const known = RANKS.find((each) => each === rank) ??
    fail(`era1に無い難易度: ${difficulty}`);
  return { dp: style === "dp", rank: known };
}

/** archive番号 → そのarchiveの先頭のfile index。songmapの`archives`の並びが番号になる */
export function archiveBaseOf(songmap: {
  archives: readonly string[];
  files: readonly { archive: string; index: number }[];
}): (archive: number) => number {
  return (archive) => {
    const name = songmap.archives[archive] ??
      fail(`archive${archive}がsongmapに無い`);
    return Math.min(
      ...songmap.files.filter((file) => file.archive === name).map((file) =>
        file.index
      ),
    );
  };
}

/**
 * 譜面の難易度が鳴らすキー音バンクのfile index。自側の値が負なら他側を使い、
 * 両側とも負なら`undefined`。`archiveBase`はarchive番号からその先頭のfile indexを返す
 */
export function pickKeysound(
  entry: Uint8Array,
  layout: KeysoundLayout,
  difficulty: string,
  archiveBase: (archive: number) => number,
): number | undefined {
  const { dp, rank } = parseDifficulty(difficulty);
  const view = new DataView(entry.buffer, entry.byteOffset, entry.byteLength);
  const read = (offset: number, other: boolean) =>
    view.getInt16(offset + (dp !== other ? 2 : 0), true);
  const table = layout[rank];
  const sideValue = (other: boolean) => {
    const override = table === undefined ? -1 : read(table, other);
    return override > 0 ? override : read(layout.hyper, other);
  };
  const own = sideValue(false);
  const other = sideValue(true);
  const value = own < 0 && other > 0 ? other : own;
  if (value < 0) return undefined;
  return layout.archiveOffset === undefined
    ? value
    : archiveBase(entry[layout.archiveOffset]) + value;
}
