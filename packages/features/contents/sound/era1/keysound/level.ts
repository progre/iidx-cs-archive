// era1のキー音の音量と定位を、PBの値へ直す。
// 直した値では、BGMに対するキー音の左右の音量が原作と同じになる。

/** PBの定位の表(`0x2440b0`)。左は`[128 - pan]`、右は`[pan]`を掛ける */
// deno-fmt-ignore
const PB_PAN = [
  0, 0, 0, 2, 2, 2, 4, 4, 4, 7, 7, 7, 10, 10, 10, 13, 13, 13, 13, 16, 16, 16,
  20, 20, 20, 24, 24, 24, 28, 28, 28, 28, 32, 32, 32, 36, 36, 36, 40, 40, 40,
  45, 45, 45, 50, 50, 50, 55, 55, 55, 60, 60, 60, 60, 65, 65, 65, 70, 70, 70,
  75, 75, 75, 80, 80, 80, 84, 84, 84, 88, 88, 88, 92, 92, 92, 96, 96, 96, 96,
  100, 100, 100, 104, 104, 104, 107, 107, 107, 110, 110, 110, 112, 112, 112,
  113, 114, 114, 114, 116, 116, 116, 118, 118, 118, 120, 120, 120, 122, 122,
  122, 123, 123, 123, 124, 124, 124, 125, 125, 125, 125, 126, 126, 126, 127,
  127, 127, 127, 127,
] as const;
/** PBのBGMの片側の係数`126 × T[127]`と、`hv << 7`の7bitを合わせた値 */
const PB_BGM_SCALE = 127 * 128;
/** era1のステレオのキー音の片側の係数。`252 / 2`を出力でさらに半分にする */
const ERA1_STEREO_SIDE = 63;
/** `+0x0C`は1バイトとして読まれる */
const MAX_VOLUME = 255;

export interface Era1Level {
  /** モノラルの`+0x08`と`+0x09`。ステレオは`null`で、PBの慣習の`(1, 127)`を書く */
  pan: number | null;
  /** `+0x0C` */
  volume: number;
}

/** PBは`+0x0C`の値に`(v × 255) >> 8`を掛けて鳴らす */
const effective = (volume: number) => (volume * 255) >> 8;
const gainOf = (gainType: number) => Math.min(gainType << 7, 0x3fff);

/**
 * 理想の`v'`を切り捨てた値と切り上げた値を候補にする。
 * 候補ごとに、PBがその`v'`で鳴らす`+0x0C`のうち最小の値を返す
 */
const volumesAround = (ideal: number) =>
  [Math.floor, Math.ceil]
    .map((round) => Math.min(effective(MAX_VOLUME), Math.max(0, round(ideal))))
    .map((applied) => Math.ceil(applied * 256 / 255));

/** 片側の目標`v' × T`を、era1の片側の係数から求める */
const targetOf = (eraSide: number, gainType: number) =>
  eraSide * PB_BGM_SCALE / gainOf(gainType);

function nearestVolume(want: number, unit: number): number {
  return volumesAround(want / unit).reduce((best, v) =>
    Math.abs(effective(v) * unit - want) <
        Math.abs(effective(best) * unit - want)
      ? v
      : best
  );
}

function monoLevel(pan: number, volume: number, gainType: number): Era1Level {
  const half = pan >> 1;
  const wantLeft = targetOf(2 * (63 - half) * volume, gainType);
  const wantRight = targetOf(2 * half * volume, gainType);
  let best = { pan: 64, volume: 0, error: Infinity };
  for (let p = 1; p <= 127; p++) {
    const left = PB_PAN[128 - p];
    const right = PB_PAN[p];
    // 左右の誤差の二乗和が最小になる v' を求め、1バイトの値へ丸める
    const ideal = (wantLeft * left + wantRight * right) /
      (left * left + right * right);
    for (const v of volumesAround(ideal)) {
      const e = effective(v);
      const error = (e * left - wantLeft) ** 2 + (e * right - wantRight) ** 2;
      if (error < best.error) {
        best = { pan: p, volume: v, error };
      }
    }
  }
  return { pan: best.pan, volume: best.volume };
}

/** era1の旧エントリの`ch`・`pan`(+0x06)・`volume`(+0x05)から、PBの定位と音量を求める */
export function era1LevelOf(
  entry: { ch: number; pan: number; volume: number },
  gainType: number,
): Era1Level {
  if (entry.volume === 0) {
    return { pan: entry.ch === 2 ? null : 64, volume: 0 };
  }
  if (entry.ch === 2) {
    const want = targetOf(ERA1_STEREO_SIDE * entry.volume, gainType);
    return { pan: null, volume: nearestVolume(want, PB_PAN[127]) };
  }
  return monoLevel(entry.pan, entry.volume, gainType);
}
